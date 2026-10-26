"""Verify every archived evidence member and the SQLite backup."""

import argparse
from contextlib import closing
import hashlib
import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()

    with zipfile.ZipFile(args.archive) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP CRC check failed")
        manifest = json.loads(archive.read("manifest.json"))
        actual = set(archive.namelist()) - {"manifest.json"}
        expected = {entry["path"] for entry in manifest}
        if actual != expected or len(expected) != len(manifest):
            raise SystemExit("ZIP member list differs from manifest")
        for entry in manifest:
            data = archive.read(entry["path"])
            if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
                raise SystemExit(f"Evidence digest mismatch: {entry['path']}")
        with tempfile.TemporaryDirectory() as temporary:
            database = Path(temporary) / "state.sqlite3"
            database.write_bytes(archive.read("control/state.sqlite3"))
            with closing(sqlite3.connect(database)) as connection:
                integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise SystemExit(f"SQLite integrity check failed: {integrity}")

    print(json.dumps({
        "archive": str(args.archive.resolve()),
        "sha256": hashlib.sha256(args.archive.read_bytes()).hexdigest(),
        "manifest_entries": len(manifest),
        "captures": sum(item["path"].startswith("captures/") for item in manifest),
        "probe_snapshots": sum(item["path"].startswith("control/probe_blobs/")
                               for item in manifest),
        "live_artifacts": sum(item["path"].startswith("evidence/live/")
                              for item in manifest),
        "sqlite_integrity": integrity,
    }, indent=2))


if __name__ == "__main__":
    main()
