"""Hash-check full WebProcess RX maps and inventory fixed-number syscall sites."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PREFIX = b"\x48\xc7\xc0"
ARG_MOVE = b"\x49\x89\xca"
SYSCALL = b"\x0f\x05"


def inspect(data: bytes) -> tuple[int, list[dict]]:
    raw_count = 0
    fixed = []
    position = 0
    while (position := data.find(SYSCALL, position)) >= 0:
        raw_count += 1
        if (position >= 10 and data[position - 10:position - 7] == PREFIX
                and data[position - 3:position] == ARG_MOVE):
            number = int.from_bytes(data[position - 7:position - 3], "little")
            fixed.append({"offset": position - 10, "number": number,
                          "next_bytes": data[position + 2:position + 8].hex()})
        position += 2
    return raw_count, fixed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    mappings = []
    all_numbers = set()
    for mapping in manifest["maps"]:
        if mapping.get("kind") != "rx":
            continue
        item = {"index": mapping["index"], "start": mapping["start"],
                "size": mapping["size"], "status": mapping["status"]}
        if mapping["status"] == "complete":
            file = ROOT / mapping["file"]
            blob = file.read_bytes()
            if len(blob) != mapping["size"] or \
                    hashlib.sha256(blob).hexdigest() != mapping["sha256"]:
                raise ValueError(f"RX mapping {mapping['index']} failed digest check")
            raw, fixed = inspect(blob)
            item.update(sha256=mapping["sha256"], literal_syscall_pairs=raw,
                        fixed_number_sites=fixed)
            all_numbers.update(site["number"] for site in fixed)
        mappings.append(item)
    report = {"firmware": manifest["firmware"], "session_id": manifest["session_id"],
              "pid": manifest["pid"], "scope": "literal syscall pairs and exact fixed-number byte motif in hash-checked RX mappings; control-flow reachability remains unproven",
              "complete_rx_count": sum(m["status"] == "complete" for m in mappings),
              "partial_rx_count": sum(m["status"] != "complete" for m in mappings),
              "fixed_numbers": sorted(all_numbers), "maps": mappings}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"complete_rx_count": report["complete_rx_count"],
                      "partial_rx_count": report["partial_rx_count"],
                      "fixed_numbers": len(all_numbers),
                      "nonzero_maps": [{"index": m["index"],
                                        "pairs": m["literal_syscall_pairs"],
                                        "fixed": len(m["fixed_number_sites"])}
                                       for m in mappings if m.get("literal_syscall_pairs")]},
                     indent=2))


if __name__ == "__main__":
    main()
