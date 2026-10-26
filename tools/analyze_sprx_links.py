"""Resolve live x86-64 import thunks within verified SPRX memory mappings.

This is a structural map of the captured browser process, not an export table.
Only six-byte RIP-relative `jmp [rip+disp32]` stubs whose pointer slot lies in
the same module's captured RO/RW span are accepted.
"""

from __future__ import annotations

import argparse
import json
import struct
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def target_module(address: int, modules: list[dict]) -> dict | None:
    for module in modules:
        rx = module["segments"].get("rx")
        if rx and rx["start"] <= address < rx["start"] + rx["size"]:
            return module
    return None


def analyze(manifest: Path) -> dict:
    source = json.loads(manifest.read_text(encoding="utf-8"))
    modules = source["modules"]
    links: list[dict] = []
    for module in modules:
        spans = module["segments"]
        rx = spans.get("rx")
        if not rx or not rx["complete"]:
            continue
        code = (ROOT / rx["file"]).read_bytes()
        if len(code) != rx["size"]:
            raise ValueError(f"RX size mismatch for {module['name']}")
        tables = []
        for kind in ("ro", "rw"):
            span = spans.get(kind)
            if span and span["complete"]:
                data = (ROOT / span["file"]).read_bytes()
                if len(data) != span["size"]:
                    raise ValueError(f"{kind} size mismatch for {module['name']}")
                tables.append((kind, span["start"], data))
        for index in range(len(code) - 5):
            if code[index:index + 2] != b"\xff\x25":
                continue
            displacement = struct.unpack_from("<i", code, index + 2)[0]
            site = rx["start"] + index
            slot = site + 6 + displacement
            for kind, table_start, data in tables:
                offset = slot - table_start
                if not 0 <= offset <= len(data) - 8:
                    continue
                target = struct.unpack_from("<Q", data, offset)[0]
                destination = target_module(target, modules)
                if destination is None:
                    continue
                links.append({
                    "source_handle": module["handle"],
                    "source_module": module["name"],
                    "source_offset": index,
                    "slot_kind": kind,
                    "slot_offset": offset,
                    "target_address": target,
                    "target_handle": destination["handle"],
                    "target_module": destination["name"],
                    "target_offset": target - destination["segments"]["rx"]["start"],
                })
                break
    counts = Counter((item["source_module"], item["target_module"])
                     for item in links)
    return {
        "firmware_label": source["firmware_label"],
        "session_id": source["session_id"],
        "manifest": str(manifest.relative_to(ROOT)).replace("\\", "/"),
        "resolved_live_thunks": len(links),
        "edges": [{"from": src, "to": dst, "count": count}
                  for (src, dst), count in sorted(counts.items())],
        "thunks": links,
        "interpretation": "Live relocated pointers in one browser process; not proof of API use or permission.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = analyze(args.manifest.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"{report['resolved_live_thunks']} thunks across {len(report['edges'])} module edges")
    print(args.output)


if __name__ == "__main__":
    main()
