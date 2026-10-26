"""Index method wrappers decompiled from the verified 14.00 LNC image."""

from __future__ import annotations

import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "evidence/live/full_sprx/2119cf8f1a734dc5a6b964e8c2b1d3fb"
INPUTS = [
    BASE / "analysis_elf/lnc_request_range.txt",
    BASE / "analysis_elf/lnc_request_range_2.txt",
]


def main() -> None:
    requests: list[dict] = []
    for path in INPUTS:
        source = path.read_text(encoding="utf-8")
        for section in re.split(r"(?=^=== [0-9a-f]+ body=)", source, flags=re.M):
            match = re.match(r"=== ([0-9a-f]+) body=([0-9]+) ===", section)
            if not match:
                continue
            calls = [line.strip() for line in section.splitlines()
                     if re.search(r"0x300[0-9a-f]{2}", line)]
            if len(calls) != 1:
                continue
            call = calls[0]
            method = re.search(r"0x300[0-9a-f]{2}", call).group()
            slot = re.search(r"\*param_1 \+ 0x([0-9a-f]+)", call)
            sizes = re.findall(r"local_30 = (0x[0-9a-f]+|[0-9]+);", section)
            requests.append({
                "method_id": method,
                "function_address": "0x" + match.group(1),
                "rx_offset": "0x" + format(int(match.group(1), 16) - 0x807728000, "x"),
                "function_body_bytes": int(match.group(2)),
                "vtable_offset": "0x" + slot.group(1) if slot else None,
                "output_descriptor_length": int(sizes[-1], 0) if sizes else None,
                "decompiled_call": call,
            })
    requests.sort(key=lambda item: int(item["method_id"], 16))
    ids = [int(item["method_id"], 16) for item in requests]
    if ids != list(range(0x30000, 0x3004C)):
        raise ValueError(f"expected contiguous 0x30000..0x3004b; got {len(ids)}")
    output = BASE / "lnc_request_map.json"
    output.write_text(json.dumps({"count": len(requests), "requests": requests}, indent=2) + "\n",
                      encoding="utf-8")
    print(output, len(requests))


if __name__ == "__main__":
    main()
