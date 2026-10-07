"""Register files for the loader's tests."""

import csv
import io
from collections.abc import Mapping, Sequence

# The register's header, written out so that a change to the loader's
# expected columns cannot also change the files it is tested with.
HEADER = (
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
ELM_HALL_ADDRESS = (
    "Elm Hall Nursing Home, Loughlinstown Road, Celbridge, W23 P6EX"
)
ELM_HALL_URL = (
    "https://www.hiqa.ie/areas-we-work/find-a-centre/elm-hall-nursing-home"
)
ELM_HALL = {
    "Centre_ID": "34",
    "Centre_Title": "Elm Hall Nursing Home",
    "Centre_Address": ELM_HALL_ADDRESS,
    "County": "Kildare",
    "Maximum_Occupancy": "62",
    "Registration_Provider": "Springwood Nursing Homes Limited",
    "CRO_Registration_Number": "409166",
    "URL": ELM_HALL_URL,
}


def centre(centre_id: str, **columns: str) -> dict[str, str]:
    """Elm Hall's record with another centre ID and any columns changed."""
    return {**ELM_HALL, "Centre_ID": centre_id, **columns}


def register_csv(
    *records: Mapping[str, str], columns: Sequence[str] = HEADER
) -> bytes:
    """A register file as HIQA writes it; columns not given are empty."""
    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerow(columns)
    writer.writerows(
        [record.get(name, "") for name in columns] for record in records
    )
    return text.getvalue().encode()
