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
            provider_name="Health Service Executive",
            provider_cro_number=None,
            hiqa_url=ELM_HALL_URL,
        ),
    )


def test_address_without_an_eircode_has_none() -> None:
    address = "Elm Hall Nursing Home, Loughlinstown Road, Celbridge"
    register = register_csv(centre("34", Centre_Address=address))

    assert read_register(register)[0].eircode is None


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
