"""Wrap verified live SPRX mappings as an analysis-only ELF64 image.

The result is not a Sony SPRX or a reconstruction of its on-disk file.
It maps the captured RX/RO/RW memory at their observed virtual addresses
so ordinary disassemblers can resolve live relocated pointers.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parent.parent
ALIGN = 0x1000


def aligned(value: int) -> int:
    return (value + ALIGN - 1) & ~(ALIGN - 1)


def build(manifest: Path, handle: int, output: Path) -> dict:
    manifest_bytes = manifest.read_bytes()
    report = json.loads(manifest_bytes)
    matches = [m for m in report["modules"] if m["handle"] == handle]
    if len(matches) != 1:
        raise ValueError("module handle missing or ambiguous")
    module = matches[0]
    spans = []
    for kind, flags in (("rx", 5), ("ro", 4), ("rw", 6)):
        segment = module["segments"].get(kind)
        if not segment or not segment["complete"]:
            raise ValueError(f"missing complete {kind} segment")
        data = (ROOT / segment["file"]).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != segment["size"] or digest != segment["sha256"]:
            raise ValueError(f"{kind} segment differs from verified manifest")
        if segment["start"] % ALIGN or len(data) % ALIGN:
            raise ValueError("mapping lacks page alignment")
        spans.append((kind, flags, segment["start"], data, digest))
    identity = b"\x7fELF" + bytes([2, 1, 1, 0]) + bytes(8)
    header = struct.pack("<16sHHIQQQIHHHHHH", identity, 2, 62, 1,
                         spans[0][2], 64, 0, 0, 64, 56, len(spans), 0, 0, 0)
    headers = bytearray()
    offset = ALIGN
    layout = []
    for kind, flags, start, data, digest in spans:
        headers.extend(struct.pack("<IIQQQQQQ", 1, flags, offset,
                                   start, start, len(data), len(data), ALIGN))
        layout.append({"kind": kind, "virtual_address": start,
                       "file_offset": offset, "size": len(data),
                       "sha256": digest})
        offset = aligned(offset + len(data))
    image = bytearray(header + headers)
    image.extend(bytes(ALIGN - len(image)))
    for (_, _, _, data, _), item in zip(spans, layout):
        image.extend(bytes(item["file_offset"] - len(image)))
        image.extend(data)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(image)
    sidecar = {
        "kind": "analysis-only synthetic ELF64",
        "not_original_binary": True,
        "module_handle": handle,
        "module_name": module["name"],
        "firmware_label": report["firmware_label"],
        "session_id": report["session_id"],
        "source_manifest": str(manifest.relative_to(ROOT)).replace("\\", "/"),
        "source_manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "segments": layout,
        "synthetic_sha256": hashlib.sha256(image).hexdigest(),
    }
    output.with_suffix(".json").write_text(json.dumps(sidecar, indent=2) + "\n",
                                            encoding="utf-8")
    return sidecar


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--handle", type=lambda x: int(x, 0), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    sidecar = build(args.manifest.resolve(), args.handle, args.output.resolve())
    print(sidecar["module_name"], sidecar["synthetic_sha256"])
    print(args.output)


if __name__ == "__main__":
    main()
