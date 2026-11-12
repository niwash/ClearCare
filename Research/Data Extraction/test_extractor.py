"""Offline regression checks for the v2 extraction contract and failure handling."""

import hashlib
import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import Mock, patch

import anthropic
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

    def test_response_schema_omits_unsupported_string_length_constraints(self):
        schema = AmenitiesResult.model_json_schema()

        def check(value):
            if isinstance(value, dict):
                self.assertNotIn("minLength", value)
                self.assertNotIn("maxLength", value)
                for child in value.values():
                    check(child)
            elif isinstance(value, list):
                for child in value:
                    check(child)

        check(schema)
        quote = schema["$defs"]["Evidence"]["properties"]["quote"]
        self.assertEqual(quote["type"], "string")
        for text in ("", " ", "\n\t"):
            with self.subTest(quote=text), self.assertRaises(ValidationError):
                Amenities.model_validate(
                    dict(payload(), facilities=[garden(quote=text)])
                )

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
            text, pages = extractor.extract_text_from_pdf(Path("source.pdf"))
        self.assertEqual(pages, ["cover", "", "garden"])
        self.assertEqual(
            text, "[PDF PAGE 1]\ncover\n[PDF PAGE 2]\n\n[PDF PAGE 3]\ngarden"
        )

    def test_model_failures_and_oversized_input(self):
        client = Mock()
        for reason, refusal, parsed in [
            ("length", None, None),
            ("stop", "refused", None),
            ("stop", None, None),
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
            self.assertIsNone(
                extractor.call_llm(client, "openai", "1", "2026-01-01", "text")
            )
        client.reset_mock()
        self.assertIsNone(
            extractor.call_llm(
                client, "openai", "1", "2026-01-01", "x" * (extractor.MAX_CHARS + 1)
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
        result = extractor.call_llm(client, "openai", "1", "2026-01-01", "text")
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
                    return_value=(
                        "[PDF PAGE 1]\nAn accessible garden.",
                        ["An accessible garden."],
                    ),
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
                self.assertIsNotNone(
                    extractor.process_centre(
                        Mock(), "openai", "1", report, root, root, False
                    )
                )
                output = extractor.output_file(root, "1", digest)
                before = output.read_bytes()
                self.assertEqual(call.call_args.args[1], "openai")
                stored = ExtractionFile.model_validate_json(before)
                self.assertEqual(stored.amenities.facilities[0].item, "Garden")
                self.assertEqual(stored.model, "gpt-4o-mini-2024-07-18")
                self.assertIsNotNone(
                    extractor.process_centre(
                        Mock(), "openai", "1", report, root, root, False
                    )
                )
                self.assertEqual(call.call_count, 1)
                with patch.object(Path, "replace", side_effect=OSError("write failed")):
                    self.assertIsNone(
                        extractor.process_centre(
                            Mock(), "openai", "1", report, root, root, True
                        )
                    )
                self.assertEqual(output.read_bytes(), before)
                self.assertEqual(list(output.parent.glob("*.tmp")), [])
                call.return_value = None
                self.assertIsNone(
                    extractor.process_centre(
                        Mock(), "openai", "1", report, root, root, True
                    )
                )
                self.assertEqual(output.read_bytes(), before)
            self.assertEqual(
                json.loads(legacy.read_text())["extractor_version"], "amenities-v1"
            )
            wrong_version = json.loads(before)
            wrong_version["extractor_version"] = "amenities-v1"
            output.write_text(json.dumps(wrong_version))
            self.assertFalse(extractor.already_done(output, digest))


def claude_reply(stop_reason="end_turn", parsed_output=None):
    return SimpleNamespace(
        stop_reason=stop_reason,
        parsed_output=parsed_output,
        model="model-as-reported",
        usage=SimpleNamespace(input_tokens=12000, output_tokens=900),
    )


def result(*facilities):
    return AmenitiesResult(
        amenities=Amenities.model_validate(dict(payload(), facilities=list(facilities)))
    )


class AnthropicTests(unittest.TestCase):
    def test_complete_response_records_the_reported_model(self):
        client = Mock()
        client.messages.parse.return_value = claude_reply(
            parsed_output=result(garden())
        )
        amenities, model = extractor.call_llm(
            client, "anthropic", "1", "2026-01-01", "text"
        )
        self.assertEqual(amenities.facilities[0].item, "Garden")
        self.assertEqual(model, "model-as-reported")
        request = client.messages.parse.call_args.kwargs
        self.assertEqual(request["model"], "claude-haiku-5-5")
        self.assertEqual(request["system"], extractor.SYSTEM_PROMPT)
        self.assertIs(request["output_format"], AmenitiesResult)
        self.assertNotIn("temperature", request)
        client.beta.chat.completions.parse.assert_not_called()

    def test_truncated_refused_or_invalid_output_fails(self):
        for name, reply in {
            "truncated": claude_reply("max_tokens", result(garden())),
            "refused": claude_reply("refusal"),
            "no output": claude_reply("end_turn"),
        }.items():
            client = Mock()
            client.messages.parse.return_value = reply
            with self.subTest(name):
                self.assertIsNone(
                    extractor.call_llm(client, "anthropic", "1", "2026-01-01", "text")
                )

    def test_output_cut_off_mid_json_fails(self):
        # parse validates the text itself, so it raises before returning. The
        # model is asked once more, and the centre fails on the second reply.
        client = Mock()
        client.messages.parse.side_effect = lambda **_: (
            AmenitiesResult.model_validate_json('{"amenities": {')
        )
        self.assertIsNone(
            extractor.call_llm(client, "anthropic", "1", "2026-01-01", "text")
        )
        self.assertEqual(client.messages.parse.call_count, 2)

    def test_a_reply_outside_the_contract_is_asked_for_once_more(self):
        try:
            Amenities.model_validate(dict(payload(), facilities=[garden(), garden()]))
        except ValidationError as error:
            duplicate_item = error
        client = Mock()
        client.messages.parse.side_effect = [
            duplicate_item,
            claude_reply(parsed_output=result(garden())),
        ]
        with self.assertLogs(extractor.log, "WARNING"):
            amenities, _ = extractor.call_llm(
                client, "anthropic", "1", "2026-01-01", "text"
            )
        self.assertEqual(amenities.facilities[0].item, "Garden")
        self.assertEqual(client.messages.parse.call_count, 2)

    def test_api_errors_fail_the_centre(self):
        for error in (
            anthropic.APIStatusError(
                "bad request", response=Mock(status_code=400, headers={}), body=None
            ),
            anthropic.APIConnectionError(request=Mock()),
        ):
            client = Mock()
            client.messages.parse.side_effect = error
            with self.subTest(error=type(error).__name__):
                self.assertIsNone(
                    extractor.call_llm(client, "anthropic", "1", "2026-01-01", "text")
                )

    def test_main_builds_the_client_of_the_chosen_provider(self):
        with TemporaryDirectory() as folder:
            manifest = Path(folder, "manifests", extractor.MANIFEST_NAME)
            manifest.parent.mkdir()
            manifest.write_text("")
            for options, module, client_class in (
                ([], "anthropic", "Anthropic"),
                (["--provider", "openai"], "openai", "OpenAI"),
            ):
                fake = SimpleNamespace(**{client_class: Mock()})
                argv = [
                    "extractor.py",
                    "--report-source",
                    "manifest",
                    "--data-dir",
                    folder,
                    *options,
                ]
                with (
                    self.subTest(options=options),
                    patch.dict("sys.modules", {module: fake}),
                    patch.object(sys, "argv", argv),
                ):
                    extractor.main()
                    getattr(fake, client_class).assert_called_once_with()


class DatabaseSelectionTests(unittest.TestCase):
    def test_database_metadata_and_undated_reports(self):
        from datetime import date

        connection = Mock()
        connection.execute.return_value = [
            (
                "659",
                date(2026, 1, 9),
                "a" * 64,
                "https://example.test/reports/report%20name.pdf",
            ),
            ("5307", None, "b" * 64, "https://example.test/undated.pdf"),
        ]
        context = Mock()
        context.__enter__ = Mock(return_value=connection)
        context.__exit__ = Mock(return_value=False)
        with patch("psycopg.connect", return_value=context):
            reports = extractor.database_reports()
        self.assertEqual(list(reports), ["659"])
        self.assertEqual(reports["659"]["inspection_date"], "2026-01-09")
        self.assertEqual(reports["659"]["file_name"], "report name.pdf")


def stored_report(root):
    """Stores a source PDF in the raw store and returns its hash and report."""
    raw = b"source PDF bytes"
    digest = hashlib.sha256(raw).hexdigest()
    pdf = extractor.stored_pdf(root, digest)
    pdf.parent.mkdir(parents=True)
    pdf.write_bytes(raw)
    return digest, {
        "sha256": digest,
        "inspection_date": "2026-01-01",
        "file_name": "report.pdf",
        "url": "https://www.hiqa.ie/report.pdf",
    }


class EvidenceCheckTests(unittest.TestCase):
    def test_output_keeps_the_quotes_found_and_logs_the_dropped_one(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            digest, report = stored_report(root)
            page = "An accessible garden."
            bingo = {"quote": "Bingo every Friday.", "page_start": 1, "page_end": 1}
            reply = AmenitiesResult(
                amenities=Amenities.model_validate(
                    dict(
                        payload(),
                        facilities=[garden()],
                        activities=[{"item": "Bingo", "evidence": [bingo]}],
                    )
                )
            )
            client = Mock()
            client.messages.parse.return_value = claude_reply(parsed_output=reply)
            with (
                patch.object(
                    extractor,
                    "extract_text_from_pdf",
                    return_value=(f"[PDF PAGE 1]\n{page}", [page]),
                ),
                self.assertLogs(extractor.log, "WARNING") as logs,
            ):
                check = extractor.process_centre(
                    client, "anthropic", "1", report, root, root, False
                )
            self.assertEqual(
                logs.output,
                [f"WARNING:{extractor.log.name}:  dropped quote: Bingo: Bingo every Friday."],
            )
            stored = ExtractionFile.model_validate_json(
                extractor.output_file(root, "1", digest).read_bytes()
            )
            self.assertEqual(
                [entry.item for entry in stored.amenities.facilities], ["Garden"]
            )
            self.assertEqual(stored.amenities.activities, [])
            self.assertEqual((check.items_kept, check.items_dropped), (1, 1))

    def test_a_quote_cited_past_the_last_page_gets_the_page_it_is_on(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            digest, report = stored_report(root)
            pages = ["Cover.", "An accessible garden.", "", "", "Findings."]
            client = Mock()
            client.messages.parse.return_value = claude_reply(
                parsed_output=result(garden(6, 6))
            )
            with patch.object(
                extractor, "extract_text_from_pdf", return_value=("text", pages)
            ):
                self.assertIsNotNone(
                    extractor.process_centre(
                        client, "anthropic", "1", report, root, root, False
                    )
                )
            stored = ExtractionFile.model_validate_json(
                extractor.output_file(root, "1", digest).read_bytes()
            )
            evidence = stored.amenities.facilities[0].evidence[0]
            self.assertEqual((evidence.page_start, evidence.page_end), (2, 2))


if __name__ == "__main__":
    unittest.main()
