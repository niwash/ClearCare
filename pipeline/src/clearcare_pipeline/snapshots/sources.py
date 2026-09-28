"""The HIQA registers snapshotted every day."""

from dataclasses import dataclass


@dataclass(frozen=True)
class SnapshotSource:
    """A file HIQA overwrites in place, of which we keep a daily copy.

    Attributes:
        name: Stable identifier used in the manifest.
        url: Where HIQA publishes the file.
        media_type: Expected Content-Type, without parameters.
        signature: Bytes a valid file starts with.
    """

    name: str
    url: str
    media_type: str
    signature: bytes


OLDER_PERSONS_REGISTER = SnapshotSource(
    name="older_persons_register",
    url=(
        "https://www.hiqa.ie/centre/export/"
        "older_persons_register.csv?_format=csv"
    ),
    media_type="text/csv",
    signature=b"Centre_ID,",
)

SECTION_64_REGISTER = SnapshotSource(
    name="section_64_register",
    url=(
        "https://www.hiqa.ie/sites/default/files/2023-11/"
        "Section-64-register-DCOP.xlsx"
    ),
    media_type=(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ),
    signature=b"PK\x03\x04",
)

REGISTER_SOURCES = (OLDER_PERSONS_REGISTER, SECTION_64_REGISTER)
