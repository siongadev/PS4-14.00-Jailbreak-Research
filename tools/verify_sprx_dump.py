"""Verify the included PS4 14.00 mapped-SPRX segment files against their manifest."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CAPTURE_ROOT = ROOT / "evidence" / "live" / "full_sprx"
MANIFEST = (CAPTURE_ROOT / "2119cf8f1a734dc5a6b964e8c2b1d3fb" /
            "manifest.json")


def verify() -> tuple[int, int, int]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("firmware_label") != "14.00":
        raise ValueError("unexpected firmware label")
    modules = manifest.get("modules")
    if not isinstance(modules, list) or not modules:
        raise ValueError("missing module list")

    seen: set[Path] = set()
    total_bytes = 0
    for module in modules:
        segments = module.get("segments")
        if not isinstance(segments, dict) or not segments:
            raise ValueError(f"missing segments: {module.get('name')}")
        for kind, entry in segments.items():
            if kind not in {"rx", "ro", "rw"} or entry.get("complete") is not True:
                raise ValueError(f"incomplete or unexpected segment: {module.get('name')} {kind}")
            path = (ROOT / entry["file"]).resolve()
            if not path.is_relative_to(CAPTURE_ROOT.resolve()) or path in seen:
                raise ValueError(f"invalid or duplicate segment path: {path}")
            seen.add(path)
            digest = hashlib.sha256()
            size = 0
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
                    size += len(chunk)
            if size != entry["size"] or size != entry["covered_prefix"]:
                raise ValueError(f"size mismatch: {path}")
            if digest.hexdigest() != entry["sha256"]:
                raise ValueError(f"SHA-256 mismatch: {path}")
            total_bytes += size
    return len(modules), len(seen), total_bytes


if __name__ == "__main__":
    module_count, segment_count, byte_count = verify()
    print(f"Verified {module_count} modules, {segment_count} segments, {byte_count} bytes")
