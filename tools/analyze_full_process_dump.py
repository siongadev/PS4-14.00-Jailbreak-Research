"""Integrity-check and structurally inventory one captured WebProcess map set.

The output deliberately excludes raw strings and individual heap pointers: a
browser snapshot can contain private page data. Addresses are valid only for
the captured process. This does not merge snapshots from different PIDs.
"""

from __future__ import annotations

import argparse
from bisect import bisect_right
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import struct


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SESSION = "cae1c2f0636c4430ab13130bf6e1d974"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", default=DEFAULT_SESSION)
    args = parser.parse_args()
    base = ROOT / "evidence/live/full_process" / args.session
    manifest_path = base / "manifest.json"
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    comparison = json.loads((base / "rx_comparison.json").read_text())
    module_by_rx = {row["index"]: row["matching_sprx"] for row in comparison["maps"]}
    maps = manifest["maps"]
    starts = [m["start"] for m in maps]
    if starts != sorted(starts):
        raise ValueError("manifest maps are not address ordered")

    def destination(value: int) -> dict | None:
        j = bisect_right(starts, value) - 1
        if j < 0:
            return None
        item = maps[j]
        if value >= item["start"] + item["size"]:
            return None
        if not item.get("file"):
            return None
        return item

    records = []
    for item in maps:
        row = {k: item.get(k) for k in
               ("index", "start", "size", "prot", "type", "kind", "status", "sha256")}
        if not item.get("file"):
            records.append(row)
            continue
        data = (ROOT / item["file"]).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if len(data) != item["size"] or digest != item["sha256"]:
            raise ValueError(f"map {item['index']} failed size/hash verification")
        row["zero_bytes"] = data.count(0)
        row["nonzero_bytes"] = len(data) - row["zero_bytes"]
        row["ascii_runs_8plus"] = len(re.findall(rb"[\x20-\x7e]{8,}", data))
        row["elf_magic_count"] = data.count(b"\x7fELF")
        row["syscall_byte_pair_count"] = data.count(b"\x0f\x05") if item["kind"] == "rx" else None
        counts = Counter()
        # Recorded mappings begin on 16 KiB boundaries, so aligned qwords
        # preserve their virtual alignment. Values are classification leads,
        # not proof that a qword is a pointer.
        for (word,) in struct.iter_unpack("<Q", data[:len(data) & ~7]):
            if word == 0:
                continue
            target = destination(word)
            if target is not None:
                counts[(target["index"], target.get("kind", "unreadable"))] += 1
        row["mapped_qwords"] = sum(counts.values())
        row["rx_qwords"] = sum(n for (target, kind), n in counts.items()
                               if kind == "rx")
        row["top_pointer_destinations"] = [
            {"map": target, "kind": kind, "count": n}
            for (target, kind), n in counts.most_common(8)
        ]
        records.append(row)

    for rx_index, name in module_by_rx.items():
        if name is None:
            continue
        trio = [records[i - 1] for i in (rx_index, rx_index + 1, rx_index + 2)]
        if [r["kind"] for r in trio] != ["rx", "ro", "rw"]:
            raise ValueError(f"unexpected segment grouping after map {rx_index}")
        for rec in trio:
            rec["module_candidate"] = name
    # Only the executable start itself is a hash-confirmed module match.
    for rec in records:
        if rec["index"] in module_by_rx:
            rec["rx_hash_match"] = module_by_rx[rec["index"]]

    summary = {
        "session_id": args.session,
        "pid": manifest["pid"],
        "firmware": manifest["firmware"],
        "source_manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "map_count": len(maps),
        "verified_file_count": sum(bool(m.get("file")) for m in maps),
        "verified_bytes": sum(m["size"] for m in maps if m.get("file")),
        "unreadable_or_skipped_bytes": sum(m["size"] for m in maps if not m.get("file")),
        "by_kind": dict(Counter(r["kind"] or "unavailable" for r in records)),
        "bytes_by_kind": dict(Counter({
            kind: sum(r["size"] for r in records if (r["kind"] or "unavailable") == kind)
            for kind in {r["kind"] or "unavailable" for r in records}
        })),
        "mapped_qwords": sum(r.get("mapped_qwords", 0) for r in records
                             if r["kind"] in ("ro", "rw")),
        "rx_qwords": sum(r.get("rx_qwords", 0) for r in records
                         if r["kind"] in ("ro", "rw")),
        "limitations": [
            "Writable mappings were captured sequentially, not atomically.",
            "One 16 KiB readable mapping is missing; unreadable/reserved mappings are not present.",
            "Qword counts only cover RO/RW sources in the summary, target captured readable mappings, and remain syntactic leads rather than proven pointers.",
            "No raw browser strings or heap pointer values are emitted by this inventory.",
        ],
    }
    result = {"summary": summary, "maps": records}
    (base / "structural_inventory.json").write_text(
        json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print("largest non-module RW maps:")
    for r in sorted((r for r in records if r["kind"] == "rw" and not r.get("module_candidate")),
                    key=lambda r: r["size"], reverse=True)[:12]:
        print(r["index"], hex(r["start"]), r["size"],
              "nonzero", r["nonzero_bytes"], "mapped_qwords", r["mapped_qwords"],
              "rx_qwords", r["rx_qwords"], "strings", r["ascii_runs_8plus"])


if __name__ == "__main__":
    main()
