"""One bounded run: its advisory lock and its row in the ledger (ADR-0021).

A scheduled task is one run from the container starting to the container
stopping. Two of them must not write to the database at the same time, and a
migration must not run while one is, so a run holds a session-level advisory
lock for its whole length. The lock is taken before anything is restored from
the bucket, so a task that will do nothing does not download the data
directory first.

The same connection records the run in ``clearcare.pipeline_run``, so a run
that was killed leaves an open row behind.
"""

import logging

import psycopg
from psycopg.rows import TupleRow

# Fixed, and documented: the migrate task takes this same key before it runs
# Flyway. The stages' own locks are 31, 34 and 76 and are held only for a
# transaction, so none of them can collide with a run.
LOCK_KEY = 149

logger = logging.getLogger(__name__)

Connection = psycopg.Connection[TupleRow]


class PipelineRun:
    """A run's advisory lock, and the ledger row that says it happened."""

    def __init__(self, connection: Connection, run_id: int) -> None:
        """Wraps a connection that already holds the lock and an open row."""
        self._connection = connection
        self._run_id = run_id

    @classmethod
    def try_begin(cls) -> "PipelineRun | None":
        """Takes the lock and opens the run's row.

        Returns:
            The run, or None if another run or a migration holds the lock.

        Raises:
            psycopg.Error: If the database cannot be reached or written.
        """
        connection: Connection = psycopg.connect(autocommit=True)
        try:
            if not _lock(connection):
                connection.close()
                return None
            return cls(connection, _open(connection))
        except Exception:
            connection.close()
            raise

    def finish(self, outcome: str, exit_code: int, detail: str | None) -> None:
        """Closes the run's row, and logs if that cannot be done.

        It does not raise: it runs while the run's own error, if any, is
        being handled, and that error is the one worth reporting.
        """
        try:
            with self._connection.cursor() as cursor:
                cursor.execute(
                    "UPDATE clearcare.pipeline_run SET finished_at = now(),"
                    " outcome = %s, exit_code = %s, detail = %s WHERE id = %s",
                    (outcome, exit_code, detail, self._run_id),
                )
        except psycopg.Error as error:
            logger.error("cannot record run %d: %s", self._run_id, error)

    def close(self) -> None:
        """Releases the lock and closes the connection."""
        try:
            with self._connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", (LOCK_KEY,))
        except psycopg.Error as error:
            logger.warning("cannot release the run lock: %s", error)
        finally:
            # Closing the connection releases the lock too, so a failed
            # unlock above cannot leave it held.
            self._connection.close()


def _lock(connection: Connection) -> bool:
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_KEY,))
        row = cursor.fetchone()
    return row is not None and bool(row[0])


def _open(connection: Connection) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO clearcare.pipeline_run DEFAULT VALUES RETURNING id"
        )
        row = cursor.fetchone()
    if row is None:
        raise psycopg.ProgrammingError("the run's row was not inserted")
    return int(row[0])
