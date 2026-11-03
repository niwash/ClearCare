"""Offline regression checks for the v2 extraction contract and failure handling."""

import hashlib
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import Mock, patch

import extractor
from amenities_v2 import CATEGORY_ORDER, Amenities, AmenitiesResult, ExtractionFile
from pydantic import ValidationError


def payload():
    return {"care_types": [], "room_types": [], "activities": [], "facilities": []}


def garden(start=1, end=1, quote="An accessible garden."):
    return {
        "item": "Garden",
        "evidence": [{"quote": quote, "page_start": start, "page_end": end}],
    }


class ContractTests(unittest.TestCase):
    def test_categories_match_the_approved_schema(self):
        # Keep the implementation aligned with the frozen approved contract.
        schema = json.loads(
            Path(__file__)
            .with_name("amenities-v2.schema.json")
            .read_text(encoding="utf-8")
        )
        actual = Amenities.model_json_schema()
        for field, choices in CATEGORY_ORDER.items():
            approved = schema["properties"]["amenities"]["properties"][field]["items"][
                "properties"
            ]["item"]["enum"]
            self.assertEqual(choices, approved)
            reference = actual["properties"][field]["items"]["$ref"].split("/")[-1]
            self.assertEqual(
                actual["$defs"][reference]["properties"]["item"]["enum"], approved
            )
        self.assertEqual(sum(map(len, CATEGORY_ORDER.values())), 93)

    def test_exact_fields_and_required_lists(self):
        for bad in (
            {},
            dict(payload(), other_notes="extra"),
            dict(payload(), facilities=None),
        ):
            with self.subTest(bad=bad), self.assertRaises(ValidationError):
                Amenities.model_validate(bad)
        self.assertEqual(Amenities.model_validate(payload()).model_dump(), payload())

    def test_invalid_evidence_and_categories_are_rejected(self):
        cases = [
            garden(2, 1),
            garden(0, 1),
            garden(1, 1, " "),
            garden(True, 1),
            {"item": "Garden", "evidence": []},
            {"item": "Unknown", "evidence": garden()["evidence"]},
            {"item": "Garden", "evidence": [{"quote": "words", "page_start": 1}]},
            dict(garden(), extra=True),
        ]
        for entry in cases:
            with self.subTest(entry=entry), self.assertRaises(ValidationError):
                Amenities.model_validate(dict(payload(), facilities=[entry]))
        with self.assertRaises(ValidationError):
            Amenities.model_validate(dict(payload(), care_types=[garden()]))

    def test_page_bounds_duplicates_and_multiple_passages(self):
        with self.assertRaises(ValidationError):
            Amenities.model_validate(dict(payload(), facilities=[garden(), garden()]))
        entry = garden(1, 2)
        entry["evidence"] += (
            garden(1, 2)["evidence"] + garden(3, 3, "Staff assist access.")["evidence"]
        )
        result = Amenities.model_validate(dict(payload(), facilities=[entry]))
        self.assertEqual(len(result.facilities[0].evidence), 2)
        self.assertIs(result.validate_pages(3), result)
        with self.assertRaises(ValueError):
            result.validate_pages(2)

    def test_original_pdf_pages_include_blank_pages(self):
        pdf = Mock()
        pdf.__enter__ = Mock(return_value=pdf)
        pdf.__exit__ = Mock(return_value=False)
        pdf.pages = [
            Mock(extract_text=Mock(return_value=t)) for t in ("cover", None, "garden")
        ]
        with patch.dict(
            "sys.modules", {"pdfplumber": SimpleNamespace(open=Mock(return_value=pdf))}
        ):
            text, count = extractor.extract_text_from_pdf(Path("source.pdf"))
        self.assertEqual(count, 3)
        self.assertEqual(
            text, "[PDF PAGE 1]\ncover\n[PDF PAGE 2]\n\n[PDF PAGE 3]\ngarden"
        )

    def test_model_failures_and_oversized_input(self):
        client = Mock()
        for reason, refusal, parsed in [
            ("length", None, None),
            ("stop", "refused", None),
            ("stop", None, None),
            (
                "stop",
                None,
                AmenitiesResult(
                    amenities=Amenities.model_validate(
                        dict(payload(), facilities=[garden(4, 4)])
                    )
                ),
            ),
        ]:
            client.beta.chat.completions.parse.return_value = SimpleNamespace(
                usage=None,
                model="gpt-4o-mini-2024-07-18",
                choices=[
                    SimpleNamespace(
                        finish_reason=reason,
                        message=SimpleNamespace(refusal=refusal, parsed=parsed),
                    )
                ],
            )
            self.assertIsNone(extractor.call_llm(client, "1", "2026-01-01", "text", 3))
        client.reset_mock()
        self.assertIsNone(
            extractor.call_llm(
                client, "1", "2026-01-01", "x" * (extractor.MAX_CHARS + 1), 3
            )
        )
        client.beta.chat.completions.parse.assert_not_called()

    def test_provenance_requires_exact_keys_date_and_utc_timestamp(self):
        valid = {
            "centre_id": "1",
            "inspection_date": "2026-01-01",
            "file_name": "report.pdf",
            "hiqa_url": "https://www.hiqa.ie/report.pdf",
            "sha256": "a" * 64,
            "model": "gpt-4o-mini",
            "extractor_version": "amenities-v2",
            "extracted_at": "2026-11-03T01:00:00Z",
            "amenities": payload(),
        }
        self.assertEqual(
            ExtractionFile.model_validate_json(json.dumps(valid)).centre_id, "1"
        )
        for change in (
            {"centre_id": "../1"},
            {"sha256": "invalid"},
            {"inspection_date": "2026-02-30"},
            {"file_name": " "},
            {"hiqa_url": "missing scheme"},
            {"extra": True},
            {"extracted_at": "2026-11-03T01:00:00"},
            {"extracted_at": "2026-11-03T01:00:00+01:00"},
        ):
            with self.subTest(change=change), self.assertRaises(ValidationError):
                ExtractionFile.model_validate_json(json.dumps(valid | change))

    def test_successful_model_response_records_actual_model(self):
        client = Mock()
        client.beta.chat.completions.parse.return_value = SimpleNamespace(
            usage=None,
            model="gpt-4o-mini-2024-07-18",
            choices=[
                SimpleNamespace(
                    finish_reason="stop",
                    message=SimpleNamespace(
                        refusal=None,
                        parsed=AmenitiesResult(
                            amenities=Amenities.model_validate(payload())
                        ),
                    ),
                )
            ],
        )
        result = extractor.call_llm(client, "1", "2026-01-01", "text", 1)
        self.assertEqual(result[0].model_dump(), payload())
        self.assertEqual(result[1], "gpt-4o-mini-2024-07-18")

    def test_history_cache_and_failure_preserve_good_output(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            raw = b"source PDF bytes"
            digest = hashlib.sha256(raw).hexdigest()
            pdf = extractor.stored_pdf(root, digest)
            pdf.parent.mkdir(parents=True)
            pdf.write_bytes(raw)
            report = {
                "sha256": digest,
                "inspection_date": "2026-01-01",
                "file_name": "report.pdf",
                "url": "https://www.hiqa.ie/report.pdf",
            }
            legacy = root / "1.json"
            legacy.write_text('{"extractor_version":"amenities-v1"}')
            with (
                patch.object(
                    extractor,
                    "extract_text_from_pdf",
                    return_value=("[PDF PAGE 1]\ngarden", 1),
                ),
                patch.object(
                    extractor,
                    "call_llm",
                    return_value=(
                        Amenities.model_validate(
                            dict(payload(), facilities=[garden()])
                        ),
                        "gpt-4o-mini-2024-07-18",
                    ),
                ) as call,
            ):
                self.assertTrue(
                    extractor.process_centre(Mock(), "1", report, root, root, False)
                )
                output = extractor.output_file(root, "1", digest)
                before = output.read_bytes()
                stored = ExtractionFile.model_validate_json(before)
                self.assertEqual(stored.amenities.facilities[0].item, "Garden")
                self.assertEqual(stored.model, "gpt-4o-mini-2024-07-18")
                self.assertTrue(
                    extractor.process_centre(Mock(), "1", report, root, root, False)
                )
                self.assertEqual(call.call_count, 1)
                with patch.object(Path, "replace", side_effect=OSError("write failed")):
                    self.assertFalse(
                        extractor.process_centre(Mock(), "1", report, root, root, True)
                    )
                self.assertEqual(output.read_bytes(), before)
                self.assertEqual(list(output.parent.glob("*.tmp")), [])
                call.return_value = None
                self.assertFalse(
                    extractor.process_centre(Mock(), "1", report, root, root, True)
                )
                self.assertEqual(output.read_bytes(), before)
            self.assertEqual(
                json.loads(legacy.read_text())["extractor_version"], "amenities-v1"
            )
            wrong_version = json.loads(before)
            wrong_version["extractor_version"] = "amenities-v1"
            output.write_text(json.dumps(wrong_version))
            self.assertFalse(extractor.already_done(output, digest))


if __name__ == "__main__":
    unittest.main()
