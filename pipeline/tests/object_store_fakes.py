"""An in-memory object store for tests."""

from clearcare_pipeline.object_store import ObjectStoreError


class FakeObjectStore:
    """Keeps objects in a dict; can be told to fail on given keys."""

    def __init__(
        self,
        objects: dict[str, bytes] | None = None,
        failing_keys: frozenset[str] = frozenset(),
    ) -> None:
        self.objects = dict(objects or {})
        self.puts: list[str] = []
        self._failing_keys = failing_keys

    def existing_keys(self, prefix: str) -> frozenset[str]:
        return frozenset(key for key in self.objects if key.startswith(prefix))

    def put(self, key: str, body: bytes) -> None:
        if key in self._failing_keys:
            raise ObjectStoreError(f"{key}: AccessDenied")
        self.puts.append(key)
        self.objects[key] = body
