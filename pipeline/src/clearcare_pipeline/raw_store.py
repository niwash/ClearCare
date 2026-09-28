"""Content-addressed storage for raw files (ADR-0007)."""

import hashlib
import os
import tempfile
from pathlib import Path
from typing import Protocol


class RawStore(Protocol):
    """Stores raw bytes under the SHA-256 of their content."""

    def put(self, content: bytes) -> str:
        """Stores content and returns its SHA-256 hex digest."""
        ...


class FileSystemRawStore:
    """Raw store backed by a local directory.

    Files live at ``<root>/sha256/<first two hex digits>/<digest>`` and are
    made read-only once written, so a stored file is never modified.
    """

    def __init__(self, root: Path) -> None:
        """Creates a store rooted at the given directory."""
        self._root = root

    def path_for(self, sha256: str) -> Path:
        """Returns the path a file with this digest is stored at."""
        return self._root / "sha256" / sha256[:2] / sha256

    def put(self, content: bytes) -> str:
        """Stores content once and returns its SHA-256 hex digest."""
        digest = hashlib.sha256(content).hexdigest()
        target = self.path_for(digest)
        if target.exists():
            return digest
        target.parent.mkdir(parents=True, exist_ok=True)
        handle, temp_name = tempfile.mkstemp(dir=target.parent, prefix=".tmp-")
        try:
            with os.fdopen(handle, "wb") as temp:
                temp.write(content)
            Path(temp_name).chmod(0o444)
            Path(temp_name).replace(target)
        except BaseException:
            Path(temp_name).unlink(missing_ok=True)
            raise
        return digest
