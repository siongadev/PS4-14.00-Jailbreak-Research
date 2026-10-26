"""Archive raw captures, probe snapshots, live artifacts, and a SQLite backup."""

import argparse
import hashlib
import json
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("out", type=Path)
    args = parser.parse_args()

    files = sorted((ROOT / "captures").glob("*.json"))
    files += sorted(path for path in (ROOT / "control" / "probe_blobs").rglob("*") if path.is_file())
    live_files = sorted(path for path in (ROOT / "evidence" / "live").rglob("*") if path.is_file())
    files += live_files
    if not files:
        raise SystemExit("No evidence files found")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    manifest = []
    with tempfile.TemporaryDirectory() as temp_dir:
        db_copy = Path(temp_dir) / "state.sqlite3"
        with closing(sqlite3.connect(ROOT / "control" / "state.sqlite3")) as source:
            with closing(sqlite3.connect(db_copy)) as target:
                source.backup(target)

        with zipfile.ZipFile(args.out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in files + [db_copy]:
                name = "control/state.sqlite3" if path == db_copy else path.relative_to(ROOT).as_posix()
                data = path.read_bytes()
                archive.writestr(name, data)
                manifest.append({"path": name, "bytes": len(data), "sha256": sha256(data)})
            archive.writestr("manifest.json", json.dumps(manifest, indent=2) + "\n")

    print(json.dumps({
        "archive": str(args.out.resolve()),
        "sha256": sha256(args.out.read_bytes()),
        "capture_count": len(list((ROOT / "captures").glob("*.json"))),
        "probe_snapshot_count": sum(1 for path in (ROOT / "control" / "probe_blobs").rglob("*") if path.is_file()),
        "live_artifact_count": len(live_files),
    }, indent=2))


if __name__ == "__main__":
    main()
