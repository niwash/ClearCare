import pytest

from clearcare_pipeline.load_register.register_csv import (
    RegisterEntry,
    RegisterFileError,
    read_register,
)
from tests.load_register.fakes import (
    ELM_HALL,
    ELM_HALL_ADDRESS,
    ELM_HALL_URL,
    HEADER,
    centre,
    register_csv,
)

BOM = "﻿".encode()


def test_register_is_read_in_file_order() -> None:
    register = BOM + register_csv(
        # A condition over two lines is still one record.
        {**ELM_HALL, "Registration_Conditions": "Condition 1\nCondition 2"},
        centre(
            "1",
            Centre_Title="Aclare House Nursing Home",
            Centre_Address="Aclare House, Dublin 6W, D6W",
            County="Dublin",
            Maximum_Occupancy="",
            Centre_Phone="",
            Registration_Provider="Health Service Executive",
            CRO_Registration_Number="",
        ),
    )

    assert read_register(register) == (
        RegisterEntry(
            source_record=1,
            centre_id="34",
            centre_name="Elm Hall Nursing Home",
            address=ELM_HALL_ADDRESS,
            county="Kildare",
            eircode="W23P6EX",
            maximum_occupancy=62,
            centre_phone="01 555 0123",
            provider_name="Springwood Nursing Homes Limited",
            provider_cro_number="409166",
            hiqa_url=ELM_HALL_URL,
        ),
        RegisterEntry(
            source_record=2,
            centre_id="1",
            centre_name="Aclare House Nursing Home",
            address="Aclare House, Dublin 6W, D6W",
            county="Dublin",
            eircode=None,
            maximum_occupancy=None,
            centre_phone=None,
            provider_name="Health Service Executive",
            provider_cro_number=None,
            hiqa_url=ELM_HALL_URL,
        ),
    )


@pytest.mark.parametrize(
    "address",
    [
        pytest.param(
            "Elm Hall Nursing Home, Loughlinstown Road, Celbridge",
            id="town",
        ),
        # Seven letters that read as an Eircode once O is taken for 0.
        pytest.param("Main Street, Doonane", id="townland with Os"),
        # Reads as one too, but its routing key, DOO, has no digit.
        pytest.param("Main Street, Doonan 1", id="word with Os and a digit"),
    ],
)
def test_address_without_an_eircode_has_none(address: str) -> None:
    register = register_csv(centre("34", Centre_Address=address))

    assert read_register(register)[0].eircode is None


# The addresses of centres 8793 and 9276, as HIQA prints them.
@pytest.mark.parametrize(
    ("address", "eircode"),
    [
        pytest.param(
            "Kilmacanogue South, Kilmacanogue, A98 C2CO",
            "A98C2C0",
            id="centre 8793",
        ),
        pytest.param(
            "Finisklin Road, Sligo, F91 PPHO", "F91PPH0", id="centre 9276"
        ),
    ],
)
def test_letter_o_in_an_eircode_is_read_as_zero(
    address: str, eircode: str
) -> None:
    register = register_csv(centre("34", Centre_Address=address))

    assert read_register(register)[0].eircode == eircode


# The register does not always print one number, and the value is kept as it
# is printed.
@pytest.mark.parametrize(
    ("printed", "centre_phone"),
    [
        pytest.param(
            "01 555 0123 / 01 555 0124",
            "01 555 0123 / 01 555 0124",
            id="two numbers",
        ),
        pytest.param("TBC", "TBC", id="TBC"),
        pytest.param(" 01 555 0123 ", "01 555 0123", id="spaces around"),
        pytest.param(" ", None, id="blank"),
    ],
)
def test_centre_phone_is_kept_as_printed(
    printed: str, centre_phone: str | None
) -> None:
    register = register_csv(centre("34", Centre_Phone=printed))

    assert read_register(register)[0].centre_phone == centre_phone


@pytest.mark.parametrize(
    ("register", "message"),
    [
        pytest.param(
            b"Centre_ID\n\xff\n",
            "not UTF-8",
            id="not UTF-8",
        ),
        pytest.param(
            register_csv(ELM_HALL, columns=HEADER[:-1]),
            "header: expected Centre_ID,",
            id="missing column",
        ),
        pytest.param(
            register_csv(ELM_HALL, columns=(HEADER[1], HEADER[0], *HEADER[2:])),
            "header: expected Centre_ID,",
            id="columns out of order",
        ),
        pytest.param(
            register_csv(ELM_HALL) + b"35,Short\r\n",
            "record 2: expected 20 fields, got 2",
            id="short record",
        ),
        pytest.param(
            register_csv(ELM_HALL).replace(b",https:", b',"https:'),
            "record 1: unexpected end of data",
            id="quote not closed",
        ),
        pytest.param(
            register_csv(centre("34a")),
            "record 1, column Centre_ID: expected digits only, got '34a'",
            id="centre ID not digits",
        ),
        pytest.param(
            register_csv(ELM_HALL, centre("35"), ELM_HALL),
            "record 3, column Centre_ID: expected an ID no earlier record has",
            id="centre ID repeated",
        ),
        pytest.param(
            register_csv(centre("34", Centre_Title=" ")),
            "record 1, column Centre_Title: expected a value",
            id="empty column",
        ),
        pytest.param(
            register_csv(centre("34", URL="https://example.com/34")),
            "record 1, column URL: expected a page on https://www.hiqa.ie/",
            id="URL not on HIQA's site",
        ),
        pytest.param(
            register_csv(centre("34", County="Co. Kildare")),
            "record 1, column County: expected one of the 26 counties",
            id="unknown county",
        ),
        pytest.param(
            register_csv(centre("34", Maximum_Occupancy="-1")),
            "record 1, column Maximum_Occupancy: expected nothing or a whole",
            id="negative occupancy",
        ),
        pytest.param(
            register_csv(),
            "no records after the header",
            id="no records",
        ),
    ],
)
def test_register_not_in_the_expected_form_is_refused(
    register: bytes, message: str
) -> None:
    with pytest.raises(RegisterFileError, match=message):
        read_register(register)
