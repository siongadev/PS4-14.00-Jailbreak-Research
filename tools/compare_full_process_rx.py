"""Match hash-verified WebProcess RX maps to the prior complete SPRX capture."""

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("process_manifest", type=Path)
    parser.add_argument("sprx_manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    process = json.loads(args.process_manifest.read_text(encoding="utf-8"))
    sprx = json.loads(args.sprx_manifest.read_text(encoding="utf-8"))
    if process["firmware"] != sprx["firmware_label"]:
        raise ValueError("firmware labels differ")
    known = {(module["segments"]["rx"]["size"],
              module["segments"]["rx"]["sha256"]): module["name"]
             for module in sprx["modules"]}
    maps = []
    names = set()
    for mapping in process["maps"]:
        if mapping.get("kind") != "rx":
            continue
        if mapping["status"] != "complete":
            raise ValueError("cannot compare partial executable mapping")
        name = known.get((mapping["size"], mapping["sha256"]))
        maps.append({"index": mapping["index"], "start": mapping["start"],
                     "size": mapping["size"], "sha256": mapping["sha256"],
                     "matching_sprx": name})
        if name:
            names.add(name)
    report = {"process_session": process["session_id"],
              "sprx_session": sprx["session_id"],
              "rx_maps": len(maps), "matching_sprx_count": len(names),
              "prior_sprx_count": len(sprx["modules"]), "maps": maps}
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rx_maps": len(maps), "matching_sprx_count": len(names),
                      "unmatched": [m["index"] for m in maps if not m["matching_sprx"]]}))


if __name__ == "__main__":
    main()
