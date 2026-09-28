import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from clearcare_pipeline.snapshots.fetch import (
    USER_AGENT,
    FetchError,
    UrllibFetcher,
)

REGISTER_BODY = b"Centre_ID,Centre_Title\n"


class _Handler(BaseHTTPRequestHandler):
    user_agents: list[str] = []  # noqa: RUF012

    def do_GET(self) -> None:
        type(self).user_agents.append(self.headers.get("User-Agent", ""))
        if self.path == "/register.csv":
            self._reply(200, "text/csv; charset=utf-8", REGISTER_BODY)
        else:
            self._reply(503, "text/html", b"<html>Browser Verification</html>")

    def _reply(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Last-Modified", "Mon, 28 Sep 2026 06:00:00 GMT")
        self.send_header("ETag", '"1"')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return None


@pytest.fixture
def server() -> Iterator[str]:
    _Handler.user_agents.clear()
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()
    httpd.server_close()


def test_fetch_returns_body_and_headers(server: str) -> None:
    result = UrllibFetcher().fetch(f"{server}/register.csv")

    assert result.status == 200
    assert result.content_type == "text/csv; charset=utf-8"
    assert result.body == REGISTER_BODY
    assert result.last_modified == "Mon, 28 Sep 2026 06:00:00 GMT"
    assert result.etag == '"1"'


def test_fetch_identifies_the_project(server: str) -> None:
    UrllibFetcher().fetch(f"{server}/register.csv")

    assert _Handler.user_agents == [USER_AGENT]


def test_http_error_status_is_returned_not_raised(server: str) -> None:
    result = UrllibFetcher().fetch(f"{server}/blocked")

    assert result.status == 503
    assert b"Browser Verification" in result.body


def test_unreachable_host_raises_fetch_error() -> None:
    with pytest.raises(FetchError):
        UrllibFetcher(timeout=2).fetch("http://127.0.0.1:9/")
