"""Collect and verify the 14.00 IPMI read-only mapping next to the RX entry.

The browser probe owns the read and restores its temporary pointer. This tool
queues one hash-pinned command at a time and never retries an interrupted claim.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path
import sqlite3
import time

from fw14lab.control import DEFAULT_DB, enqueue_probe
from fw14lab.verify import verify_capture


ROOT = Path(__file__).resolve().parent.parent
PROBE = ROOT / "probes" / "clone_history_ipmi_ro_dump_v1.json"
CAPTURES = ROOT / "captures"
OUTPUT = ROOT / "evidence" / "live" / "ro_0x833f0c000_14.00.bin"
TOTAL_SIZE = 0x4000
PART_SIZE = 0x900
PART_COUNT = 8


def decoded_chunks(record: dict) -> list[tuple[int, bytes]]:
    submission = record["submission"]
    if submission["context"]["probe_id"] != "clone_history_ipmi_ro_dump_v1":
        raise ValueError("unexpected probe identity")
    if [check["id"] for check in submission["checks"]] != [
        "ipmi_ro_dump_a_v1", "ipmi_ro_dump_b_v1"
    ]:
        raise ValueError("unexpected check identifiers")
    output = []
    for check in submission["checks"]:
        if check["status"] != "pass" or check["details"]["restored"] is not True:
            raise ValueError("failed or unrestored live read")
        details = check["details"]
        offset = details["offset"]
        if type(offset) is not int or not 0 <= offset <= TOTAL_SIZE + 1152:
            raise ValueError("invalid offset")
        pieces = [base64.b64decode(details[f"b{i}"], validate=True) for i in range(3)]
        if any(len(piece) > 384 for piece in pieces):
            raise ValueError("oversized piece")
        data = b"".join(pieces)
        if offset > TOTAL_SIZE and data:
            raise ValueError("nonempty data starts beyond mapping")
        output.append((offset, data))
    return output


def matching_records(session_id: str) -> list[dict]:
    found = []
    for path in CAPTURES.glob("*.json"):
        candidate = json.loads(path.read_text(encoding="utf-8"))
        context = candidate.get("submission", {}).get("context", {})
        if (context.get("session_id") == session_id and
                context.get("probe_id") == "clone_history_ipmi_ro_dump_v1"):
            found.append(verify_capture(path))
    return found


def coverage(records: list[dict]) -> tuple[bytearray, list[bool], list[str]]:
    image = bytearray(TOTAL_SIZE)
    covered = [False] * TOTAL_SIZE
    by_part: dict[int, str] = {}
    expected_source = hashlib.sha256(PROBE.with_suffix(".js").read_bytes()).hexdigest()
    for record in records:
        context = record["submission"]["context"]
        if context["source_sha256"] != expected_source:
            raise ValueError("probe source digest changed")
        parts = decoded_chunks(record)
        part = parts[0][0] // PART_SIZE
        if not 0 <= part < PART_COUNT or parts[0][0] != part * PART_SIZE:
            raise ValueError("unexpected part start")
        if parts[1][0] != part * PART_SIZE + 1152:
            raise ValueError("unexpected second-half offset")
        if part in by_part:
            raise ValueError("duplicate dump part")
        by_part[part] = record["capture_id"]
        for offset, data in parts:
            if not data and offset >= TOTAL_SIZE:
                continue
            if offset + len(data) > TOTAL_SIZE:
                raise ValueError("dump exceeds measured mapping")
            for i, value in enumerate(data):
                if covered[offset + i]:
                    raise ValueError("overlapping dump byte")
                image[offset + i] = value
                covered[offset + i] = True
    if sorted(by_part) != list(range(len(by_part))):
        raise ValueError("dump parts are not contiguous")
    if len(by_part) == PART_COUNT and not all(covered):
        raise ValueError("completed parts leave a coverage gap")
    return image, covered, [by_part[i] for i in sorted(by_part)]


def command_state(command_id: str) -> tuple[str, str | None]:
    with sqlite3.connect(DEFAULT_DB, timeout=5) as connection:
        row = connection.execute(
            "SELECT status,capture_id FROM commands WHERE id=?", (command_id,)
        ).fetchone()
    if row is None:
        raise ValueError("queued command missing")
    return row[0], row[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True)
    parser.add_argument("--max-parts", type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.max_parts <= PART_COUNT:
        raise SystemExit("--max-parts must be between 1 and 8")
    records = matching_records(args.session)
    image, covered, ids = coverage(records)
    print(f"Existing verified parts: {len(ids)}/{PART_COUNT}", flush=True)
    with sqlite3.connect(DEFAULT_DB, timeout=5) as connection:
        pending = connection.execute(
            "SELECT id,status FROM commands WHERE session_id=? AND "
            "probe_id=? AND status IN ('queued','claimed')",
            (args.session, "clone_history_ipmi_ro_dump_v1"),
        ).fetchall()
    if pending:
        raise SystemExit(f"Unfinished claim exists: {pending}; no new command queued")
    for part in range(len(ids), min(PART_COUNT, len(ids) + args.max_parts)):
        command_id = enqueue_probe(DEFAULT_DB, args.session, PROBE)
        print(f"Part {part}: queued {command_id}", flush=True)
        deadline = time.monotonic() + 25
        while True:
            status, capture_id = command_state(command_id)
            if status == "completed":
                break
            if time.monotonic() > deadline:
                raise SystemExit(f"Part {part} did not complete; claim {command_id} retained")
            time.sleep(0.25)
        if capture_id is None:
            raise SystemExit(f"Part {part} has no capture")
        record = verify_capture(CAPTURES / f"{capture_id}.json")
        if record["submission"]["context"]["session_id"] != args.session:
            raise SystemExit("Session mismatch")
        image, covered, ids = coverage(matching_records(args.session))
        if len(ids) != part + 1:
            raise SystemExit("Unexpected captured-part count")
        print(f"Part {part}: verified {capture_id}", flush=True)
    if not all(covered):
        print(f"Partial verified coverage: {sum(covered)}/{TOTAL_SIZE} bytes", flush=True)
        return
    if image[:8] != bytes(8):
        raise SystemExit("Mapped prefix changed")
    sample = verify_capture(CAPTURES / "eed630c6539346fdbdd9f356e6e0383e.json")
    expected_head = base64.b64decode(
        sample["submission"]["checks"][0]["details"]["head_b64"], validate=True)
    if len(expected_head) != 64 or image[:64] != expected_head:
        raise SystemExit("Mapped head sample changed")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(image)
    digest = hashlib.sha256(image).hexdigest()
    manifest = {
        "firmware_label": "14.00",
        "session_id": args.session,
        "module_name": "libSceIpmi.sprx",
        "mapping_start": "0x833f0c000",
        "mapping_end": "0x833f10000",
        "mapping_size": TOTAL_SIZE,
        "byte_source": "live browser read-only mapping read and restored through History primitive",
        "mapping_capture_id": "25a0723e373548e195b4102f5ffe0f3f",
        "sample_capture_id": "eed630c6539346fdbdd9f356e6e0383e",
        "chunk_capture_ids": ids,
        "sha256": digest,
        "identity_note": "The measured VM map lists this read-only entry directly after the libSceIpmi RX entry. Its first qwords point at functions inside that RX entry.",
    }
    OUTPUT.with_suffix(".json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Complete {TOTAL_SIZE} bytes, SHA-256 {digest}", flush=True)
    print(OUTPUT, flush=True)


if __name__ == "__main__":
    main()
