"""Verify and assemble every readable mapping in one PS4 WebProcess snapshot."""

from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fw14lab.verify import verify_capture


ROOT = Path(__file__).resolve().parent.parent
CAPTURES = ROOT / "captures"
CHUNKS = ROOT / "evidence" / "live" / "bulk_chunks"
OUTPUT = ROOT / "evidence" / "live" / "full_process"


def census(capture_ids: list[str], session: str) -> tuple[int, list[dict]]:
    maps: list[dict] = []
    pid = None
    total = None
    for capture_id in capture_ids:
        record = verify_capture(CAPTURES / f"{capture_id}.json")
        submission = record["submission"]
        context = submission["context"]
        if context["session_id"] != session or context["probe_id"] not in {
            "clone_history_full_vmmap_census_v2", "clone_history_full_vmmap_tail_v1"
        }:
            raise ValueError("unexpected VM-map census identity")
        summary = submission["checks"][0]["details"]
        if "restored" in summary and summary["restored"] is not True:
            raise ValueError("VM-map census failed its restore check")
        if pid is None:
            pid = summary["pid"]
            total = summary["count"]
        if summary["pid"] != pid or summary["count"] != total:
            raise ValueError("VM-map census changed process or count")
        for check in submission["checks"]:
            if check["status"] != "pass":
                raise ValueError("VM-map census failed a row check")
            details = check["details"]
            for row in details["rows"].split("|"):
                start_text, rest = row.split("+", 1)
                size_text, prot_text, type_text = rest.split("/")
                start = int(start_text, 16)
                size = int(size_text, 16)
                maps.append({"start": start, "size": size,
                             "prot": int(prot_text), "type": int(type_text)})
    if len(maps) != total:
        raise ValueError(f"VM-map census has {len(maps)} of {total} rows")
    previous_end = 0
    for row in maps:
        if row["start"] < previous_end or row["size"] <= 0:
            raise ValueError("VM-map census is unordered or overlapping")
        previous_end = row["start"] + row["size"]
    return pid, maps


def stored_chunks(session: str, pid: int, source: str) -> dict[tuple, dict[int, Path]]:
    found: dict[tuple, dict[int, Path]] = defaultdict(dict)
    for metadata in (CHUNKS / session).glob("*/*.json"):
        item = json.loads(metadata.read_text(encoding="utf-8"))
        if item["source_sha256"] != source:
            continue
        if (item["session_id"] != session or item["command_id"] != metadata.parent.name
                or item["pid"] != pid):
            raise ValueError(f"chunk identity mismatch: {metadata}")
        binary = metadata.with_suffix(".bin")
        data = binary.read_bytes()
        if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError(f"chunk digest mismatch: {binary}")
        if not 0 <= item["offset"] < item["range_size"] or \
                item["offset"] + len(data) > item["range_size"]:
            raise ValueError(f"chunk outside declared range: {binary}")
        key = (item["module_handle"], item["segment_kind"],
               item["range_start"], item["range_size"])
        prior = found[key].get(item["offset"])
        if prior and prior.read_bytes() != data:
            raise ValueError(f"conflicting chunks at {key} offset {item['offset']}")
        found[key][item["offset"]] = binary
    return found


def assemble(session: str, capture_ids: list[str], version: str = "v2") -> dict:
    pid, maps = census(capture_ids, session)
    source = hashlib.sha256((ROOT / "probes" /
                             f"clone_history_full_process_dump_{version}.js")
                            .read_bytes()).hexdigest()
    chunks = stored_chunks(session, pid, source)
    skipped_index = None
    if version == "v2":
        run_log = ROOT / "evidence" / "live" / f"full_process_run_{session}_v2.jsonl"
        if run_log.exists():
            first = json.loads(run_log.read_text(encoding="utf-8").splitlines()[0])
            capture = verify_capture(CAPTURES / f"{first['capture_id']}.json")
            submission = capture["submission"]
            if (submission["context"]["session_id"] != session or
                    submission["context"]["probe_id"] != "clone_history_full_process_dump_v2"):
                raise ValueError("skip capture belongs to a different page or probe")
            details = submission["checks"][0]["details"]
            skipped_index = details["skipped_index"]
            if (not 1 <= skipped_index <= len(maps) or
                    maps[skipped_index - 1]["start"] != details["skipped_start"]):
                raise ValueError("skip marker does not match census")
    output = OUTPUT / session
    output.mkdir(parents=True, exist_ok=True)
    entries = []
    expected = set()
    complete_bytes = 0
    readable_bytes = 0
    for index, mapping in enumerate(maps, 1):
        entry = {"index": index, **mapping}
        if not mapping["prot"] & 1:
            entry.update(status="unreadable", reason="map_prot_lacks_read")
            entries.append(entry)
            continue
        if index == skipped_index:
            entry.update(status="skipped_after_two_prior_page_faults",
                         reason="matching 16KiB RW mapping stopped two earlier WebProcess dumps")
            readable_bytes += mapping["size"]
            entries.append(entry)
            continue
        readable_bytes += mapping["size"]
        kind = "rx" if mapping["prot"] == 5 else "ro" if mapping["prot"] == 1 else "rw"
        key = (index, kind, mapping["start"], mapping["size"])
        expected.add(key)
        pieces = chunks.get(key, {})
        position = 0
        for offset in sorted(pieces):
            if offset != position:
                break
            position += pieces[offset].stat().st_size
        entry.update(kind=kind, covered_prefix=position, chunk_count=len(pieces),
                     status="complete" if position == mapping["size"] else "partial")
        if position == mapping["size"]:
            target = output / f"map_{index:03d}_{mapping['start']:012x}_{kind}.bin"
            digest = hashlib.sha256()
            with target.open("wb") as out:
                for offset in sorted(pieces):
                    data = pieces[offset].read_bytes()
                    out.write(data)
                    digest.update(data)
            entry["file"] = str(target.relative_to(ROOT)).replace("\\", "/")
            entry["sha256"] = digest.hexdigest()
            complete_bytes += mapping["size"]
        entries.append(entry)
    extras = set(chunks) - expected
    if extras:
        raise ValueError(f"uploaded chunks outside census: {sorted(extras)[:3]}")
    manifest = {"session_id": session, "pid": pid, "firmware": "14.00",
                "census_capture_ids": capture_ids, "probe_source_sha256": source,
                "probe_version": version,
                "map_count": len(maps), "readable_map_count": len(expected) + (skipped_index is not None),
                "readable_bytes": readable_bytes, "complete_bytes": complete_bytes,
                "complete": complete_bytes == readable_bytes,
                "scope": "readable VM mappings of one WebProcess; excludes kernel and other processes",
                "snapshot_note": "Mappings were copied sequentially; mutable pages are not an atomic snapshot.",
                "maps": entries}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n",
                                            encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True)
    parser.add_argument("--census", nargs=2, required=True, metavar=("FIRST", "TAIL"))
    parser.add_argument("--version", choices=("v1", "v2"), default="v2")
    args = parser.parse_args()
    result = assemble(args.session, args.census, args.version)
    print(json.dumps({key: result[key] for key in ("map_count", "readable_map_count",
                                               "readable_bytes", "complete_bytes", "complete")},
                     indent=2))


if __name__ == "__main__":
    main()
