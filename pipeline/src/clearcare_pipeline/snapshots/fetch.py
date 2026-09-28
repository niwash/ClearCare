"""Fetching files over HTTP."""

import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import Message
from typing import Protocol

USER_AGENT = (
    "ClearCare/0.1 (research project; +https://github.com/niwash/ClearCare)"
)


@dataclass(frozen=True)
class FetchResult:
    """What the server returned for one request."""

    status: int
    content_type: str | None
    body: bytes
    last_modified: str | None
    etag: str | None


class FetchError(Exception):
    """The request failed before any HTTP response arrived."""


class Fetcher(Protocol):
    """Fetches a URL."""

    def fetch(self, url: str) -> FetchResult:
        """Returns the response to a GET request for the URL."""
        ...


class UrllibFetcher:
    """Fetcher built on the standard library."""

    def __init__(
        self, user_agent: str = USER_AGENT, timeout: float = 60.0
    ) -> None:
        """Creates a fetcher that identifies itself with user_agent."""
        self._user_agent = user_agent
        self._timeout = timeout

    def fetch(self, url: str) -> FetchResult:
        """Returns the response, including error statuses such as 503.

        Raises:
            FetchError: If no HTTP response was received.
        """
        request = urllib.request.Request(
            url, headers={"User-Agent": self._user_agent}
        )
        try:
            with urllib.request.urlopen(
                request, timeout=self._timeout
            ) as response:
                return _result(
                    response.status, response.headers, response.read()
                )
        except urllib.error.HTTPError as error:
            return _result(error.code, error.headers, error.read())
        except OSError as error:
            raise FetchError(str(error)) from error


def _result(status: int, headers: Message, body: bytes) -> FetchResult:
    return FetchResult(
        status=status,
        content_type=headers.get("Content-Type"),
        body=body,
        last_modified=headers.get("Last-Modified"),
        etag=headers.get("ETag"),
    )
