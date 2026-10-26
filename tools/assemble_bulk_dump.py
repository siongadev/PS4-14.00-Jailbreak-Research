"""Verify exact per-byte coverage of live 14.00 SPRX mappings."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from fw14lab.verify import verify_capture


ROOT = Path(__file__).resolve().parent.parent
CAPTURES = ROOT / "captures"
CHUNKS = ROOT / "evidence" / "live" / "bulk_chunks"
OUTPUT = ROOT / "evidence" / "live" / "full_sprx"


def named_modules(capture_id: str, session: str) -> dict[int, dict]:
    record = verify_capture(CAPTURES / f"{capture_id}.json")
    sub = record["submission"]
    if sub["context"]["session_id"] != session or not sub["context"]["probe_id"].startswith(
            "clone_history_bulk_module_census_"):
        raise ValueError("wrong module census identity")
    modules = {}
    for check in sub["checks"]:
        for row in check["details"].get("rows", "").split("|"):
            if not row:
                continue
            handle, rest = row.split("@", 1)
            base, name = rest.split(":", 1)
            modules[int(handle, 16)] = {"name": name, "reported_base": int(base, 16)}
    return modules


def expected_mappings(capture_id: str, session: str) -> dict[tuple[int, str], dict]:
    record = verify_capture(CAPTURES / f"{capture_id}.json")
    sub = record["submission"]
    if sub["context"]["session_id"] != session or not sub["context"]["probe_id"].startswith(
            "clone_history_bulk_map_census_"):
        raise ValueError("wrong map census identity")
    mappings = {}
    for check in sub["checks"]:
        for row in check["details"].get("rows", "").split("|"):
            if not row:
                continue
            handle_text, spans = row.split(":", 1)
            handle = int(handle_text, 16)
            for span in spans.split(","):
                kind, range_text = span.split("@", 1)
                start_text, size_text = range_text.split("+", 1)
                key = (handle, kind)
                if key in mappings:
                    raise ValueError("duplicate map kind")
                mappings[key] = {"start": int(start_text, 16),
                                 "size": int(size_text, 16)}
    return mappings


def read_chunks(session: str) -> dict[tuple[int, str, int, int], dict[int, tuple[Path, dict]]]:
    found = {}
    for metadata in (CHUNKS / session).glob("*/*.json"):
        item = json.loads(metadata.read_text(encoding="utf-8"))
        if item["session_id"] != session or item["command_id"] != metadata.parent.name:
            raise ValueError("chunk identity mismatch")
        binary = metadata.with_suffix(".bin")
        data = binary.read_bytes()
        if len(data) != item["bytes"] or hashlib.sha256(data).hexdigest() != item["sha256"]:
            raise ValueError(f"chunk digest mismatch: {binary}")
        key = (item["module_handle"], item["segment_kind"],
               item["range_start"], item["range_size"])
        offset = item["offset"]
        if offset < 0 or offset + len(data) > item["range_size"]:
            raise ValueError("chunk range invalid")
        chunks = found.setdefault(key, {})
        if offset in chunks:
            previous_data = chunks[offset][0].read_bytes()
            if previous_data != data:
                raise ValueError("conflicting chunk at same range offset")
        else:
            chunks[offset] = (binary, item)
    return found


def assemble(session: str, module_capture: str, map_capture: str) -> dict:
    names = named_modules(module_capture, session)
    expected = expected_mappings(map_capture, session)
    captured = read_chunks(session)
    directory = OUTPUT / session
    directory.mkdir(parents=True, exist_ok=True)
    modules: dict[int, dict] = {}
    for (handle, kind), mapping in expected.items():
        key = (handle, kind, mapping["start"], mapping["size"])
        chunks = captured.get(key, {})
        position = 0
        for offset in sorted(chunks):
            if offset != position:
                break
            position += chunks[offset][1]["bytes"]
        module = modules.setdefault(handle, {**names.get(handle, {"name": "unknown"}),
                                             "handle": handle, "segments": {}})
        info = {**mapping, "covered_prefix": position, "complete": position == mapping["size"],
                "chunk_count": len(chunks)}
        if info["complete"]:
            module_dir = directory / f"{handle:04x}"
            module_dir.mkdir(parents=True, exist_ok=True)
            output = module_dir / f"{kind}.bin"
            digest = hashlib.sha256()
            with output.open("wb") as file:
                for offset in sorted(chunks):
                    data = chunks[offset][0].read_bytes()
                    file.write(data)
                    digest.update(data)
            info["sha256"] = digest.hexdigest()
            info["file"] = str(output.relative_to(ROOT)).replace("\\", "/")
        module["segments"][kind] = info
    extras = sorted(set(captured) - {
        (h, k, v["start"], v["size"]) for (h, k), v in expected.items()
    })
    if extras:
        raise ValueError(f"uploaded ranges do not match map census: {extras}")
    report = {"firmware_label": "14.00", "session_id": session,
              "module_census_capture_id": module_capture,
              "map_census_capture_id": map_capture,
              "modules": [modules[h] for h in sorted(modules)]}
    (directory / "manifest.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True)
    parser.add_argument("--module-capture", required=True)
    parser.add_argument("--map-capture", required=True)
    args = parser.parse_args()
    report = assemble(args.session, args.module_capture, args.map_capture)
    segments = [s for m in report["modules"] for s in m["segments"].values()]
    complete = sum(s["complete"] for s in segments)
    print(f"{complete}/{len(segments)} complete segments across "
          f"{len(report['modules'])} modules")
    print(OUTPUT / args.session / "manifest.json")


if __name__ == "__main__":
    main()
