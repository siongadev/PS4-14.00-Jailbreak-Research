"""Hash-check every captured 14.00 module and summarize boundary signals.

This is a structural screen of loaded userland images, not a vulnerability
scanner or a claim that every byte has been semantically reverse engineered.
"""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
ASCII = re.compile(rb"[\x20-\x7e]{5,}")
SIGNAL = re.compile(
    r"(?:/dev/|/system_tmp/|Sce[A-Za-z0-9_]*(?:Ipc|IPC|Service|Server)|"
    r"SceSysCoreApp|SceNetCtl|SceMbusIpc|SceAvSettingIpc|"
    r"libkernel(?:_web)?\.sprx)", re.IGNORECASE
)


def inspect(manifest_path: Path, graph_path: Path) -> dict:
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    if (manifest["session_id"] != graph["session_id"] or
            manifest["firmware_label"] != graph["firmware_label"]):
        raise ValueError("manifest and import graph identify different sessions")
    outbound: dict[int, Counter[str]] = {}
    inbound: dict[int, Counter[str]] = {}
    for link in graph["thunks"]:
        outbound.setdefault(link["source_handle"], Counter())[
            link["target_module"]
        ] += 1
        inbound.setdefault(link["target_handle"], Counter())[
            link["source_module"]
        ] += 1
    rows = []
    total = 0
    for module in manifest["modules"]:
        mapped: dict[str, dict] = {}
        signal_strings: set[str] = set()
        for kind in ("rx", "ro", "rw"):
            span = module["segments"].get(kind)
            if not span or not span["complete"]:
                raise ValueError(f"{module['name']} has incomplete {kind}")
            data = (ROOT / span["file"]).read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if len(data) != span["size"] or digest != span["sha256"]:
                raise ValueError(f"{module['name']} {kind} differs from manifest")
            total += len(data)
            mapped[kind] = {"start": span["start"], "size": span["size"],
                            "sha256": digest}
            if kind != "rw":
                for match in ASCII.finditer(data):
                    string = match.group().decode("ascii", "replace")
                    if SIGNAL.search(string) and len(string) <= 160:
                        signal_strings.add(string)
        rows.append({
            "handle": module["handle"], "name": module["name"],
            "segments": mapped,
            "outbound_imports": dict(outbound.get(module["handle"], Counter())),
            "inbound_imports": dict(inbound.get(module["handle"], Counter())),
            "signal_strings": sorted(signal_strings)[:100],
        })
    return {
        "scope": "hash-checked loaded RX/RO/RW images and structural import thunks",
        "limitation": "Signals are byte strings/import links; no server/kernel implementation or execution proof",
        "firmware_label": manifest["firmware_label"],
        "session_id": manifest["session_id"],
        "source_manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "source_import_graph_sha256": hashlib.sha256(graph_path.read_bytes()).hexdigest(),
        "module_count": len(rows), "mapping_count": len(rows) * 3,
        "verified_bytes": total, "modules": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--graph", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = inspect(args.manifest.resolve(), args.graph.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in
                      ("session_id", "module_count", "mapping_count", "verified_bytes")},
                     indent=2))


if __name__ == "__main__":
    main()
