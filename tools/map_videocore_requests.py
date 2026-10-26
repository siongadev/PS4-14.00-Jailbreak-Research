"""Summarize source-defined VideoCore request wrappers from decompilation."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


BLOCK = re.compile(r"^=== ([0-9a-f]+) body=\d+ ===\n(.*?)(?=^=== |\Z)", re.M | re.S)
REQUEST = re.compile(r"\(param_\d+,0x(123400[0-9a-f]{2}),(.+?)\);", re.S)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("decomp", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = args.decomp.read_text(encoding="utf-8")
    rows = []
    for address, body in BLOCK.findall(source):
        match = REQUEST.search(body)
        if not match:
            continue
        suffix = int(match.group(1), 16) & 0xff
        call = " ".join(match.group(2).split())
        rows.append({
            "request_id": f"0x{int(match.group(1), 16):08x}",
            "request_index": suffix,
            "function_address": f"0x{int(address, 16):x}",
            "rx_offset": f"0x{int(address, 16) - 0x81408c000:x}",
            "decompiled_call_suffix": call,
        })
    rows.sort(key=lambda row: row["request_index"])
    expected = list(range(0x3a))
    if [row["request_index"] for row in rows] != expected:
        raise ValueError("request family is incomplete or duplicated")
    args.output.write_text(json.dumps({"count": len(rows), "requests": rows}, indent=2) + "\n",
                           encoding="utf-8")
    print(f"{len(rows)} VideoCore request wrappers: {args.output}")


if __name__ == "__main__":
    main()
