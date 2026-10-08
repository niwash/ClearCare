"""Reading the register of centres and checking it before it is loaded."""

import csv
import io
import re
from dataclasses import dataclass

from clearcare_pipeline.reports.register import CENTRE_PAGE_PREFIX

COLUMNS = (
    "Centre_ID",
    "Centre_Title",
    "Centre_Address",
    "County",
    "Maximum_Occupancy",
    "Centre_Phone",
    "Person_in_Charge",
    "Person_in_Charge_Phone",
    "Registration_Provider",
    "Registration_Provider_Address",
    "Registration_Provider_Phone",
    "Registration_Date",
    "Registration_Expiry_Date",
    "Expiry_Date_Note",
    "CRO_Registration_Number",
    "Management_Contacts",
    "Registration_Number",
    "Chief_Inspector_Note",
    "Registration_Conditions",
    "URL",
)
# The County enum in api/openapi.yaml.
COUNTIES = frozenset(
    {
        "Carlow",
        "Cavan",
        "Clare",
        "Cork",
        "Donegal",
        "Dublin",
        "Galway",
        "Kerry",
        "Kildare",
        "Kilkenny",
        "Laois",
        "Leitrim",
        "Limerick",
        "Longford",
        "Louth",
        "Mayo",
        "Meath",
        "Monaghan",
        "Offaly",
        "Roscommon",
        "Sligo",
        "Tipperary",
        "Waterford",
        "Westmeath",
        "Wexford",
        "Wicklow",
    }
)
# The same pattern as the check on register_entry.eircode in db/.
EIRCODE = re.compile(r"^([AC-FHKNPRTV-Y][0-9]{2}|D6W)[0-9AC-FHKNPRTV-Y]{4}$")
DIGITS = re.compile(r"[0-9]+")
NOT_EMPTY = ("Centre_Title", "Centre_Address", "County", "URL")


@dataclass(frozen=True)
class RegisterEntry:
    """One centre on the register, in the columns the database keeps.

    The register's phone numbers, persons in charge and management contacts
    are personal data and are left out.
    """

    source_record: int
    centre_id: str
    centre_name: str
    address: str
    county: str
    eircode: str | None
    maximum_occupancy: int | None
    provider_name: str | None
    provider_cro_number: str | None
    hiqa_url: str


class RegisterFileError(Exception):
    """The register file is not in the form the loader expects."""


def read_register(content: bytes) -> tuple[RegisterEntry, ...]:
    """Returns every centre on the register, in file order.

    Raises:
        RegisterFileError: If the file is not UTF-8, its header is not
            COLUMNS, or a record is not as expected. The message names the
            record and column.
    """
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise RegisterFileError(f"not UTF-8: {error}") from error
    # Strict, so that a quote left open is an error rather than a field that
    # runs to the end of the file.
    records = csv.reader(io.StringIO(text, newline=""), strict=True)
    try:
        header = tuple(next(records, ()))
    except csv.Error as error:
        raise RegisterFileError(f"header: {error}") from error
    if header != COLUMNS:
        raise RegisterFileError(
            f"header: expected {','.join(COLUMNS)}, got {','.join(header)}"
        )
    entries: list[RegisterEntry] = []
    try:
        for fields in records:
            entries.append(_entry(len(entries) + 1, fields))
    except csv.Error as error:
        raise RegisterFileError(
            f"record {len(entries) + 1}: {error}"
        ) from error
    if not entries:
        raise RegisterFileError("no records after the header")
    seen: set[str] = set()
    for entry in entries:
        if entry.centre_id in seen:
            raise _unexpected(
                entry.source_record,
                "Centre_ID",
                "an ID no earlier record has",
                entry.centre_id,
            )
        seen.add(entry.centre_id)
    return tuple(entries)


def _entry(number: int, fields: list[str]) -> RegisterEntry:
    if len(fields) != len(COLUMNS):
        raise RegisterFileError(
            f"record {number}: expected {len(COLUMNS)} fields, "
            f"got {len(fields)}"
        )
    record = dict(zip(COLUMNS, fields, strict=True))
    for column in NOT_EMPTY:
        if not record[column].strip():
            raise _unexpected(number, column, "a value", record[column])
    if not DIGITS.fullmatch(record["Centre_ID"]):
        raise _unexpected(
            number, "Centre_ID", "digits only", record["Centre_ID"]
        )
    if not record["URL"].startswith(CENTRE_PAGE_PREFIX):
        raise _unexpected(
            number, "URL", f"a page on {CENTRE_PAGE_PREFIX}", record["URL"]
        )
    if record["County"] not in COUNTIES:
        raise _unexpected(
            number, "County", "one of the 26 counties", record["County"]
        )
    occupancy = record["Maximum_Occupancy"]
    if occupancy and not DIGITS.fullmatch(occupancy):
        raise _unexpected(
            number,
            "Maximum_Occupancy",
            "nothing or a whole number of 0 or more",
            occupancy,
        )
    return RegisterEntry(
        source_record=number,
        centre_id=record["Centre_ID"],
        centre_name=record["Centre_Title"],
        address=record["Centre_Address"],
        county=record["County"],
        eircode=_eircode(record["Centre_Address"]),
        maximum_occupancy=int(occupancy) if occupancy else None,
        provider_name=record["Registration_Provider"] or None,
        provider_cro_number=record["CRO_Registration_Number"] or None,
        hiqa_url=record["URL"],
    )


def _eircode(address: str) -> str | None:
    # HIQA puts the Eircode, when there is one, after the last comma.
    candidate = "".join(address.rsplit(",", 1)[-1].split()).upper()
    return candidate if EIRCODE.match(candidate) else None


def _unexpected(
    number: int, column: str, expected: str, value: str
) -> RegisterFileError:
    return RegisterFileError(
        f"record {number}, column {column}: expected {expected}, got {value!r}"
    )
