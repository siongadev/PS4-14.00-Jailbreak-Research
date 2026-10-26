"""Create and verify a portable archive of the assembled WebProcess dump."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from fw14lab.verify import verify_capture


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for block in iter(lambda: file.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--session", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    base = ROOT / "evidence" / "live" / "full_process" / args.session
    manifest_path = base / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest["session_id"] != args.session:
        raise ValueError("manifest session mismatch")
    selected = {manifest_path, base / "syscall_sites.json", base / "rx_comparison.json",
                ROOT / "docs" / "FULL_WEBPROCESS_DUMP_14.md",
                ROOT / "probes" / "clone_history_full_process_dump_v2.js",
                ROOT / "probes" / "clone_history_full_process_dump_v2.json",
                ROOT / "probes" / "clone_history_faulted_map_byte_v1.js",
                ROOT / "probes" / "clone_history_faulted_map_byte_v1.json",
                ROOT / "evidence" / "live" / f"full_process_run_{args.session}_v2.jsonl",
                ROOT / "evidence" / "live" / "full_sprx" /
                "2119cf8f1a734dc5a6b964e8c2b1d3fb" / "manifest.json"}
    for mapping in manifest["maps"]:
        if mapping["status"] == "complete":
            path = ROOT / mapping["file"]
            if path.stat().st_size != mapping["size"] or sha256(path) != mapping["sha256"]:
                raise ValueError(f"mapping failed manifest validation: {path}")
            selected.add(path)
    run = [json.loads(line) for line in
           (ROOT / "evidence" / "live" /
            f"full_process_run_{args.session}_v2.jsonl").read_text(encoding="utf-8").splitlines()]
    if not run or run[-1]["done"] is not True:
        raise ValueError("full process run did not finish")
    capture_ids = set(manifest["census_capture_ids"])
    capture_ids.add("5671dd8f9c704520b1afd994ef16f461")
    capture_ids.update(item["capture_id"] for item in run)
    for capture_id in capture_ids:
        path = ROOT / "captures" / f"{capture_id}.json"
        record = verify_capture(path)
        if record["submission"]["context"]["session_id"] != args.session:
            raise ValueError(f"capture from different page: {capture_id}")
        selected.add(path)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        raise FileExistsError(args.output)
    with zipfile.ZipFile(args.output, "x", zipfile.ZIP_DEFLATED,
                         compresslevel=1, allowZip64=True) as archive:
        for path in sorted(selected):
            archive.write(path, path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(args.output) as archive:
        bad = archive.testzip()
        if bad:
            raise ValueError(f"archive CRC failed: {bad}")
    print(json.dumps({"file": str(args.output), "bytes": args.output.stat().st_size,
                      "sha256": sha256(args.output), "members": len(selected)}))


if __name__ == "__main__":
    main()
