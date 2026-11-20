"""Verify and unpack the frozen study inputs without network access."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import zipfile


def prepare_inputs():
    here = Path(__file__).resolve().parent
    archive = here / "inputs.zip"
    expected = (here / "inputs.sha256").read_text().split()[0]
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
        raise ValueError("Input archive checksum mismatch")
    target = here / "inputs"
    with zipfile.ZipFile(archive) as z:
        manifest = json.loads(z.read("manifest.json"))
        if len(z.namelist()) != len(set(z.namelist())) or set(z.namelist()) != set(manifest) | {"manifest.json"}:
            raise ValueError("Unexpected archive contents")
        for name, digest in manifest.items():
            relative = PurePosixPath(name)
            if relative.is_absolute() or ".." in relative.parts or "\\" in name or ":" in name:
                raise ValueError("Unsafe archive path")
            data = z.read(name)
            if hashlib.sha256(data).hexdigest() != digest:
                raise ValueError(f"Input checksum mismatch: {name}")
            path = target.joinpath(*relative.parts)
            if not path.resolve().is_relative_to(target.resolve()):
                raise ValueError("Input path escapes study directory")
            if path.exists():
                if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                    raise ValueError(f"Existing input checksum mismatch: {name}")
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
    return target


if __name__ == "__main__":
    print(prepare_inputs())
