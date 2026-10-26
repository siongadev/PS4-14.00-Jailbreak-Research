"""Decode the hash-verified 14.00 Sysmodule fixed-ID table."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parent.parent
COUNT = 0x136
RECORD_OFFSET = 0x7D0
RECORD_SIZE = 0x40


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    matches = [m for m in manifest["modules"] if m["handle"] == 16]
    if len(matches) != 1:
        raise ValueError("Sysmodule missing or ambiguous")
    module = matches[0]
    spans = []
    for kind in ("rx", "ro", "rw"):
        segment = module["segments"][kind]
        data = (ROOT / segment["file"]).read_bytes()
        if len(data) != segment["size"] or hashlib.sha256(data).hexdigest() != segment["sha256"]:
            raise ValueError(f"{kind} differs from manifest")
        spans.append((segment["start"], data))

    def read_string(pointer: int) -> str | None:
        if pointer == 0:
            return None
        for start, data in spans:
            offset = pointer - start
            if 0 <= offset < len(data):
                end = data.find(b"\0", offset, min(len(data), offset + 256))
                if end < 0:
                    return None
                return data[offset:end].decode("utf-8", errors="replace")
        return None

    rw = module["segments"]["rw"]
    blob = spans[2][1]
    rows = []
    for index in range(COUNT):
        off = RECORD_OFFSET + index * RECORD_SIZE
        record = blob[off:off + RECORD_SIZE]
        if len(record) != RECORD_SIZE:
            raise ValueError("table exceeds RW capture")
        module_id, loaded_handle, refcount, flags = struct.unpack_from("<iiii", record, 0)
        name_ptr = struct.unpack_from("<Q", record, 0x10)[0]
        dependency_ptr = struct.unpack_from("<Q", record, 0x20)[0]
        rows.append({
            "index": index,
            "record_address": f"0x{rw['start'] + off:x}",
            "module_id_signed": module_id,
            "module_id_u32": f"0x{module_id & 0xffffffff:08x}",
            "loaded_handle": loaded_handle,
            "refcount": refcount,
            "flags": flags,
            "name": read_string(name_ptr),
            "name_pointer": f"0x{name_ptr:x}",
            "dependency_pointer": f"0x{dependency_ptr:x}",
        })
    args.output.write_text(json.dumps({"count": COUNT, "records": rows}, indent=2) + "\n",
                           encoding="utf-8")
    print(f"{COUNT} Sysmodule table records: {args.output}")


if __name__ == "__main__":
    main()
