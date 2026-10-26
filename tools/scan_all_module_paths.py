"""Hash-check all mapped module code/data and list path-shaped literals.

Path strings are static leads only. They do not establish that the browser
used a path or that its process can access the named resource.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent.parent
ASCII = re.compile(rb"[\x20-\x7e]{5,}")
PATH = re.compile(
    r"/(?:dev|system(?:_data|_tmp)?|user|data|app0|hostapp|common(?:_ex)?|tmp|mnt)"
    r"(?=$|/|%)(?:[A-Za-z0-9_./%+\-])*"
)


def scan(manifest_path: Path) -> dict:
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    modules = []
    for module in manifest["modules"]:
        hits = []
        for kind in ("rx", "ro"):
            segment = module["segments"][kind]
            data = (ROOT / segment["file"]).read_bytes()
            if len(data) != segment["size"] or hashlib.sha256(data).hexdigest() != segment["sha256"]:
                raise ValueError(f"{module['name']} {kind} differs from manifest")
            for string_match in ASCII.finditer(data):
                value = string_match.group().decode("ascii")
                for path_match in PATH.finditer(value):
                    path = path_match.group()
                    if len(path) < 5 or len(path) > 160:
                        continue
                    hits.append({"path": path, "segment": kind,
                                 "offset": string_match.start() + path_match.start()})
        modules.append({"handle": module["handle"], "name": module["name"],
                        "paths": sorted(hits, key=lambda hit: (hit["path"], hit["segment"], hit["offset"]))})
    return {"scope": "hash-checked RX/RO path-shaped ASCII literals in all loaded modules",
            "limitation": "Static strings only; dynamic paths and absent server/kernel code are not covered",
            "firmware_label": manifest["firmware_label"],
            "session_id": manifest["session_id"],
            "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
            "module_count": len(modules),
            "path_literal_count": sum(len(module["paths"]) for module in modules),
            "modules": modules}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = scan(args.manifest)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("session_id", "module_count", "path_literal_count")}, indent=2))


if __name__ == "__main__":
    main()
