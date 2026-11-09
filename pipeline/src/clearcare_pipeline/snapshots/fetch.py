"""Fetching files over HTTP."""

import http.client
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import Message
from http.client import HTTPMessage
from typing import IO, Protocol

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
    """The request got no valid HTTP response, or its body was cut short."""


class Fetcher(Protocol):
    """Fetches a URL."""

    def fetch(self, url: str) -> FetchResult:
        """Returns the response to a GET request for the URL."""
        ...


class UrllibFetcher:
    """Fetcher built on the standard library."""

    def __init__(
        self,
        user_agent: str = USER_AGENT,
        timeout: float = 60.0,
        follow_redirects: bool = True,
    ) -> None:
        """Creates a fetcher that identifies itself with user_agent.

        With follow_redirects False, a redirect is returned as its 3xx
        response and its target is not requested.
        """
        self._user_agent = user_agent
        self._timeout = timeout
        self._opener = (
            urllib.request.build_opener()
            if follow_redirects
            else urllib.request.build_opener(_NoRedirects)
        )

    def fetch(self, url: str) -> FetchResult:
        """Returns the response, including error statuses such as 503.

        Raises:
            FetchError: If no valid HTTP response was received, or its body
                could not be read in full.
        """
        request = urllib.request.Request(
            url, headers={"User-Agent": self._user_agent}
        )
        # An error raised inside the HTTPError handler, such as a timeout
        # while reading a 5xx body, skips the handlers beside it, so errors
        # are caught one level out. http.client's own errors, such as
        # IncompleteRead for a body cut short, are not OSErrors.
        try:
            try:
                with self._opener.open(
                    request, timeout=self._timeout
                ) as response:
                    return _result(
                        response.status, response.headers, response.read()
                    )
            except urllib.error.HTTPError as error:
                return _result(error.code, error.headers, error.read())
        except (OSError, http.client.HTTPException) as error:
            raise FetchError(str(error)) from error


class _NoRedirects(urllib.request.HTTPRedirectHandler):
    """Leaves redirects unfollowed, so urllib reports them as HTTP errors."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: IO[bytes],
        code: int,
        msg: str,
        headers: HTTPMessage,
        newurl: str,
    ) -> None:
        """Returns None, which tells urllib not to follow the redirect."""
        return None


def _result(status: int, headers: Message, body: bytes) -> FetchResult:
    return FetchResult(
        status=status,
        content_type=headers.get("Content-Type"),
        body=body,
        last_modified=headers.get("Last-Modified"),
        etag=headers.get("ETag"),
    )
