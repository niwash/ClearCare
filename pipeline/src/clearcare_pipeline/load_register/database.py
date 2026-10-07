"""Writing a checked register snapshot to PostgreSQL and publishing it."""

from collections.abc import Sequence
from dataclasses import asdict

import psycopg
from psycopg.rows import TupleRow

from clearcare_pipeline.load_register.register_csv import RegisterEntry
from clearcare_pipeline.reports.register import RegisterDownload
from clearcare_pipeline.snapshots.sources import OLDER_PERSONS_REGISTER

# Held until the transaction ends, so two loaders never run at once. Nothing
# else takes advisory locks in this database, so any fixed number works.
LOCK_KEY = 31
# In the first eight days of snapshots the register never lost more than one
# centre a day, so a bigger drop needs a person to confirm it.
SHRINK_LIMIT = 5

Connection = psycopg.Connection[TupleRow]


class LoadRefusedError(Exception):
    """The snapshot must not be published until a person has looked."""


def publish_snapshot(
    connection: Connection,
    download: RegisterDownload,
    entries: Sequence[RegisterEntry],
    extractor_version: str,
    *,
    allow_shrink: bool,
) -> bool:
    """Loads a register snapshot and publishes it, in one transaction.

    The connection logs in as clearcare_pipeline and has no transaction open.

    Returns:
        False if this download is already the published snapshot, so nothing
        was written; True once it is loaded and published.

    Raises:
        LoadRefusedError: If this download is in the database with another
            file or is not published there, is older than the published
            snapshot, or shrinks the register by more than SHRINK_LIMIT
            centres without allow_shrink.
    """
    with connection.transaction():
        connection.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
        published = connection.execute(
            "SELECT source_file_id, fetched_at, count(*)"
            " FROM clearcare.register_publication"
            " INNER JOIN clearcare.source_file USING (source_file_id)"
            " INNER JOIN clearcare.register_entry USING (source_file_id)"
            " GROUP BY source_file_id, fetched_at"
        ).fetchone()
        loaded = connection.execute(
            "SELECT source_file_id, sha256 FROM clearcare.source_file"
            " WHERE source = %s AND url = %s AND fetched_at = %s",
            (OLDER_PERSONS_REGISTER.name, download.url, download.fetched_at),
        ).fetchone()
        if loaded is not None:
            if loaded[1] != download.sha256:
                raise LoadRefusedError(
                    f"the download fetched at {download.fetched_at} is"
                    f" already in the database with another file, {loaded[1]}"
                )
            if published is not None and loaded[0] == published[0]:
                return False
            raise LoadRefusedError(
                f"the download fetched at {download.fetched_at} is already in"
                " the database but is not the published snapshot"
            )
        if published is not None:
            _, published_fetched_at, published_centres = published
            if published_fetched_at > download.fetched_at:
                raise LoadRefusedError(
                    "the published snapshot was fetched at"
                    f" {published_fetched_at}, after this one"
                    f" ({download.fetched_at})"
                )
            shrink = published_centres - len(entries)
            if shrink > SHRINK_LIMIT and not allow_shrink:
                raise LoadRefusedError(
                    f"the register has {len(entries)} centres and the"
                    f" published snapshot has {published_centres}, more than"
                    f" {SHRINK_LIMIT} fewer; run again with --allow-shrink if"
                    " that is right"
                )
        _insert_and_publish(connection, download, entries, extractor_version)
    return True


def _insert_and_publish(
    connection: Connection,
    download: RegisterDownload,
    entries: Sequence[RegisterEntry],
    extractor_version: str,
) -> None:
    source_file = connection.execute(
        "INSERT INTO clearcare.source_file"
        " (source, url, sha256, fetched_at, http_last_modified)"
        " VALUES (%s, %s, %s, %s, %s) RETURNING source_file_id",
        (
            OLDER_PERSONS_REGISTER.name,
            download.url,
            download.sha256,
            download.fetched_at,
            download.last_modified,
        ),
    ).fetchone()
    assert source_file is not None  # INSERT ... RETURNING gives one row.
    source_file_id: int = source_file[0]
    with connection.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO clearcare.centre (centre_id) VALUES (%s)"
            " ON CONFLICT DO NOTHING",
            [(entry.centre_id,) for entry in entries],
        )
        cursor.executemany(
            "INSERT INTO clearcare.register_entry (source_file_id,"
            " source_record, centre_id, centre_name, address, county,"
            " eircode, maximum_occupancy, provider_name, provider_cro_number,"
            " hiqa_url, extracted_at, extractor_version)"
            " VALUES (%(source_file_id)s, %(source_record)s, %(centre_id)s,"
            " %(centre_name)s, %(address)s, %(county)s, %(eircode)s,"
            " %(maximum_occupancy)s, %(provider_name)s,"
            " %(provider_cro_number)s, %(hiqa_url)s, now(),"
            " %(extractor_version)s)",
            [
                {
                    **asdict(entry),
                    "source_file_id": source_file_id,
                    "extractor_version": extractor_version,
                }
                for entry in entries
            ],
        )
    connection.execute(
        "INSERT INTO clearcare.register_publication"
        " (source_file_id, published_at) VALUES (%s, now())"
        " ON CONFLICT (singleton) DO UPDATE"
        " SET source_file_id = excluded.source_file_id,"
        " published_at = excluded.published_at",
        (source_file_id,),
    )
