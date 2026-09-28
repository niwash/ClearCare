"""Taking one snapshot of one source."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from clearcare_pipeline.raw_store import RawStore
from clearcare_pipeline.snapshots.fetch import Fetcher, FetchError, FetchResult
from clearcare_pipeline.snapshots.sources import SnapshotSource


@dataclass(frozen=True)
class SnapshotRecord:
    """The manifest entry for one snapshot of one source."""

    source: str
    url: str
    fetched_at: str
    attempts: int
    http_status: int | None
    content_type: str | None
    size: int | None
    sha256: str | None
    last_modified: str | None
    etag: str | None
    error: str | None

    @property
    def ok(self) -> bool:
        """Whether a valid file was fetched and stored."""
        return self.error is None


def take_snapshot(
    source: SnapshotSource,
    fetcher: Fetcher,
    store: RawStore,
    now: Callable[[], datetime],
) -> SnapshotRecord:
    """Fetches a source once, stores it if valid, and records the outcome."""
    fetched_at = now().isoformat(timespec="seconds")
    try:
        result = fetcher.fetch(source.url)
    except FetchError as error:
        return SnapshotRecord(
            source=source.name,
            url=source.url,
            fetched_at=fetched_at,
            attempts=1,
            http_status=None,
            content_type=None,
            size=None,
            sha256=None,
            last_modified=None,
            etag=None,
            error=f"fetch failed: {error}",
        )
    problem = validate(source, result)
    sha256 = store.put(result.body) if problem is None else None
    return SnapshotRecord(
        source=source.name,
        url=source.url,
        fetched_at=fetched_at,
        attempts=1,
        http_status=result.status,
        content_type=result.content_type,
        size=len(result.body),
        sha256=sha256,
        last_modified=result.last_modified,
        etag=result.etag,
        error=problem,
    )


def validate(source: SnapshotSource, result: FetchResult) -> str | None:
    """Returns why a response is not a valid copy of the source, or None."""
    if result.status != 200:
        return f"HTTP {result.status}"
    if not result.body:
        return "empty body"
    media_type = (result.content_type or "").split(";")[0].strip().lower()
    if media_type != source.media_type:
        return f"unexpected content type {media_type or 'missing'}"
    if not result.body.startswith(source.signature):
        return "unexpected file signature"
    return None
