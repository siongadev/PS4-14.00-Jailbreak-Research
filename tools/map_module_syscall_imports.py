"""Correlate 14.00 module import slots with verified libkernel_web wrappers.

This reports static import bindings. It does not establish that a caller ran,
that a syscall succeeded, or that every indirect call target was recovered.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def checked_json(path: Path) -> tuple[dict, str]:
    data = path.read_bytes()
    return json.loads(data), hashlib.sha256(data).hexdigest()


def make_report(manifest_path: Path, graph_path: Path, catalog_path: Path) -> dict:
    manifest, manifest_hash = checked_json(manifest_path)
    graph, graph_hash = checked_json(graph_path)
    catalog, catalog_hash = checked_json(catalog_path)
    session = manifest["session_id"]
    firmware = manifest["firmware_label"]
    if any(item["session_id"] != session or item["firmware_label"] != firmware
           for item in (graph, catalog)):
        raise ValueError("input session or firmware mismatch")

    modules = {module["handle"]: module for module in manifest["modules"]}
    kernel = modules[catalog["module_handle"]]
    if kernel["name"] != catalog["module_name"]:
        raise ValueError("catalog module identity mismatch")
    rx = kernel["segments"]["rx"]
    rx_bytes = (ROOT / rx["file"]).read_bytes()
    if len(rx_bytes) != rx["size"] or hashlib.sha256(rx_bytes).hexdigest() != rx["sha256"]:
        raise ValueError("libkernel_web RX differs from the manifest")
    if rx["sha256"] != catalog["rx_sha256"] or rx["start"] != catalog["live_rx_base"]:
        raise ValueError("catalog RX identity mismatch")

    wrapper_by_offset = {}
    for stub in catalog["stubs"]:
        offset = stub["rx_offset"]
        if rx_bytes[offset:offset + len(bytes.fromhex(stub["bytes"]))].hex() != stub["bytes"]:
            raise ValueError(f"wrapper bytes mismatch at {offset:#x}")
        wrapper_by_offset[offset] = stub["number"]

    rows = defaultdict(list)
    for thunk in graph["thunks"]:
        source = modules[thunk["source_handle"]]
        target = modules[thunk["target_handle"]]
        if source["name"] != thunk["source_module"] or target["name"] != thunk["target_module"]:
            raise ValueError("graph module identity mismatch")
        if target["handle"] != kernel["handle"]:
            continue
        number = wrapper_by_offset.get(thunk["target_offset"])
        if number is None:
            continue
        segment = source["segments"][thunk["slot_kind"]]
        slot = thunk["slot_offset"]
        source_bytes = (ROOT / segment["file"]).read_bytes()
        if len(source_bytes) != segment["size"] or hashlib.sha256(source_bytes).hexdigest() != segment["sha256"]:
            raise ValueError(f"{source['name']} {thunk['slot_kind']} differs from manifest")
        if slot + 8 > len(source_bytes) or int.from_bytes(source_bytes[slot:slot + 8], "little") != thunk["target_address"]:
            raise ValueError(f"{source['name']} import slot mismatch at {slot:#x}")
        rows[source["handle"]].append({
            "number": number,
            "slot_kind": thunk["slot_kind"],
            "slot_offset": slot,
            "source_offset": thunk["source_offset"],
            "target_rx_offset": thunk["target_offset"],
        })

    result_rows = []
    for module in manifest["modules"]:
        links = sorted(rows[module["handle"]], key=lambda item: (item["number"], item["slot_offset"]))
        result_rows.append({
            "handle": module["handle"],
            "name": module["name"],
            "direct_wrapper_link_count": len(links),
            "direct_wrapper_numbers": sorted({link["number"] for link in links}),
            "links": links,
        })
    return {
        "scope": "static import slots bound to exact ordinary libkernel_web wrapper entries",
        "limitation": "No indirect-call recovery or execution/permission proof",
        "session_id": session,
        "firmware_label": firmware,
        "manifest_sha256": manifest_hash,
        "import_graph_sha256": graph_hash,
        "wrapper_catalog_sha256": catalog_hash,
        "module_count": len(result_rows),
        "matched_link_count": sum(row["direct_wrapper_link_count"] for row in result_rows),
        "modules": result_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--graph", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = make_report(args.manifest, args.graph, args.catalog)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("session_id", "module_count", "matched_link_count")}, indent=2))


if __name__ == "__main__":
    main()
