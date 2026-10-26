"""Inventory live 14.00 libkernel_web direct syscall stubs.

This is a byte-pattern inventory, not an export table or a kernel ABI spec.
The source RX segment must match the full-SPRX manifest digest exactly.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
STUB = re.compile(
    rb"\x48\xc7\xc0(?P<number>.{4})\x49\x89\xca\x0f\x05"
    rb"\x72\x01\xc3\x48\x8d\x0d(?P<error_disp>.{4})\xff\xe1",
    re.DOTALL,
)
SPECIAL = re.compile(
    rb"\x48\xc7\xc0(?P<number>.{4})\x49\x89\xca\x0f\x05",
    re.DOTALL,
)


def build(manifest_path: Path, import_graph_path: Path | None = None,
          callgraph_path: Path | None = None) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    matches = [m for m in manifest["modules"] if m["name"] == "libkernel_web.sprx"]
    if len(matches) != 1:
        raise ValueError("libkernel_web.sprx missing or ambiguous")
    module = matches[0]
    segment = module["segments"]["rx"]
    rx = (ROOT / segment["file"]).read_bytes()
    if not segment["complete"] or len(rx) != segment["size"]:
        raise ValueError("RX segment is incomplete")
    if hashlib.sha256(rx).hexdigest() != segment["sha256"]:
        raise ValueError("RX digest mismatch")
    base = segment["start"]
    stubs = []
    for match in STUB.finditer(rx):
        offset = match.start()
        number = int.from_bytes(match.group("number"), "little", signed=False)
        disp = int.from_bytes(match.group("error_disp"), "little", signed=True)
        error_jump = base + offset + match.end() - match.start() - 2 + disp
        stubs.append({
            "rx_offset": offset,
            "live_address": base + offset,
            "number": number,
            "error_jump_candidate": error_jump,
            "bytes": match.group().hex(),
        })
    raw_syscalls = [index for index in range(len(rx) - 1) if rx[index:index + 2] == b"\x0f\x05"]
    matched_syscalls = {stub["rx_offset"] + 10 for stub in stubs}
    special_sites = []
    for match in SPECIAL.finditer(rx):
        syscall_offset = match.end() - 2
        if syscall_offset in matched_syscalls:
            continue
        special_sites.append({
            "rx_offset": match.start(),
            "syscall_offset": syscall_offset,
            "number": int.from_bytes(match.group("number"), "little"),
            "bytes": match.group().hex(),
        })
    accounted = matched_syscalls | {site["syscall_offset"] for site in special_sites}
    report = {
        "module_name": module["name"],
        "firmware_label": manifest["firmware_label"],
        "session_id": manifest["session_id"],
        "module_handle": module["handle"],
        "live_rx_base": base,
        "rx_size": len(rx),
        "rx_sha256": segment["sha256"],
        "raw_syscall_byte_pairs": len(raw_syscalls),
        "matched_direct_stubs": len(stubs),
        "unique_numbers": len({stub["number"] for stub in stubs}),
        "special_syscall_sites": special_sites,
        "other_0f05_byte_offsets": [i for i in raw_syscalls if i not in accounted],
        "stubs": stubs,
    }
    if import_graph_path is not None:
        graph = json.loads(import_graph_path.read_text(encoding="utf-8"))
        if graph["session_id"] != manifest["session_id"]:
            raise ValueError("import graph session differs from module dump")
        inbound = [item for item in graph["thunks"]
                   if item["target_module"] == module["name"]]
        sources: dict[int, Counter[str]] = defaultdict(Counter)
        for item in inbound:
            sources[item["target_offset"]][item["source_module"]] += 1
        stub_by_offset = {item["rx_offset"]: item["number"] for item in stubs}
        report["inbound_import_links"] = len(inbound)
        report["unique_inbound_target_offsets"] = len(sources)
        report["inbound_targets"] = [
            {
                "rx_offset": offset,
                "direct_syscall_number": stub_by_offset.get(offset),
                "links": sum(counts.values()),
                "sources": dict(sorted(counts.items())),
            }
            for offset, counts in sorted(sources.items())
        ]
    if callgraph_path is not None:
        if "inbound_targets" not in report:
            raise ValueError("callgraph analysis requires import graph")
        calls: dict[int, set[int]] = defaultdict(set)
        with callgraph_path.open(newline="", encoding="utf-8") as stream:
            for row in csv.DictReader(stream):
                caller = int(row["caller"], 16) - base
                callee = int(row["callee"], 16) - base
                if 0 <= caller < len(rx) and 0 <= callee < len(rx):
                    calls[caller].add(callee)
        stub_by_offset = {item["rx_offset"]: item["number"] for item in stubs}
        special_by_offset = {item["rx_offset"]: item["number"]
                             for item in special_sites}
        for target in report["inbound_targets"]:
            entry = target["rx_offset"]
            one_hop = {entry} | calls.get(entry, set())
            target["one_hop_syscall_numbers"] = sorted(
                {stub_by_offset[node] for node in one_hop if node in stub_by_offset}
                | {special_by_offset[node] for node in one_hop if node in special_by_offset}
            )
            target["direct_intra_image_callee_count"] = len(calls.get(entry, ()))
        report["callgraph_direct_edges"] = sum(map(len, calls.values()))
        report["callgraph_scope"] = "Ghidra direct intra-image calls, one hop only; misses indirect calls and does not prove runtime reachability"
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--import-graph", type=Path)
    parser.add_argument("--callgraph", type=Path)
    args = parser.parse_args()
    report = build(args.manifest, args.import_graph, args.callgraph)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    csv_path = args.output.with_suffix(".csv")
    rows = [
        {"kind": "ordinary", "number": item["number"],
         "rx_offset": f"0x{item['rx_offset']:x}",
         "syscall_offset": f"0x{item['rx_offset'] + 10:x}",
         "live_address": f"0x{item['live_address']:x}",
         "bytes": item["bytes"]}
        for item in report["stubs"]
    ] + [
        {"kind": "special", "number": item["number"],
         "rx_offset": f"0x{item['rx_offset']:x}",
         "syscall_offset": f"0x{item['syscall_offset']:x}",
         "live_address": f"0x{report['live_rx_base'] + item['rx_offset']:x}",
         "bytes": item["bytes"]}
        for item in report["special_syscall_sites"]
    ]
    with csv_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=(
            "kind", "number", "rx_offset", "syscall_offset", "live_address", "bytes"))
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda item: (item["number"],
                                                  int(item["rx_offset"], 16))))
    print(f"{report['matched_direct_stubs']} stubs, {report['unique_numbers']} unique numbers, "
          f"{len(report['special_syscall_sites'])} special sites, "
          f"{len(report['other_0f05_byte_offsets'])} other 0f05 byte pairs")
    print(args.output)
    print(csv_path)


if __name__ == "__main__":
    main()
