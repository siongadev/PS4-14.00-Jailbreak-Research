"""Upload one measured 14.00 WebProcess VM mapping per verified command."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import time

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fw14lab.control import DEFAULT_DB, enqueue_probe
from fw14lab.verify import verify_capture


ROOT = Path(__file__).resolve().parent.parent
CAPTURES = ROOT / "captures"


def rows(sql: str, args: tuple) -> list[sqlite3.Row]:
    with sqlite3.connect(DEFAULT_DB, timeout=5) as db:
        db.row_factory = sqlite3.Row
        return db.execute(sql, args).fetchall()


def ensure_ready(session: str) -> None:
    session_rows = rows("SELECT last_seen_at FROM sessions WHERE id=?", (session,))
    if not session_rows:
        raise RuntimeError("unknown session")
    last = datetime.fromisoformat(session_rows[0]["last_seen_at"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - last).total_seconds()
    if age > 15:
        raise RuntimeError(f"page stopped polling {age:.0f}s ago")
    pending = rows("SELECT id,status FROM commands WHERE session_id=? AND "
                   "status IN ('queued','claimed') AND cancelled_at IS NULL", (session,))
    if pending:
        raise RuntimeError(f"unfinished command exists: {[dict(x) for x in pending]}")


def wait_completed(command_id: str) -> str:
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        found = rows("SELECT status,capture_id FROM commands WHERE id=?", (command_id,))
        if found and found[0]["status"] == "completed":
            capture = found[0]["capture_id"]
            if capture:
                return capture
            raise RuntimeError("completed command has no capture")
        time.sleep(0.25)
    raise RuntimeError(f"command {command_id} remains claimed; do not replay")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True)
    parser.add_argument("--max-commands", type=int, default=300)
    parser.add_argument("--version", choices=("v1", "v2"), default="v2")
    args = parser.parse_args()
    if not 1 <= args.max_commands <= 500:
        raise SystemExit("max-commands outside 1..500")
    probe_id = f"clone_history_full_process_dump_{args.version}"
    check_id = f"full_process_dump_{args.version}"
    probe = ROOT / "probes" / f"{probe_id}.json"
    log = ROOT / "evidence" / "live" / f"full_process_run_{args.session}_{args.version}.jsonl"
    log.parent.mkdir(parents=True, exist_ok=True)
    for index in range(args.max_commands):
        ensure_ready(args.session)
        command_id = enqueue_probe(DEFAULT_DB, args.session, probe)
        print(f"queued {index + 1}: {command_id}", flush=True)
        capture_id = wait_completed(command_id)
        capture = verify_capture(CAPTURES / f"{capture_id}.json")
        context = capture["submission"]["context"]
        checks = capture["submission"]["checks"]
        if (context["session_id"] != args.session or
                context["command_id"] != command_id or
                context["probe_id"] != probe_id or
                len(checks) != 1 or checks[0]["id"] != check_id or
                checks[0]["status"] != "pass" or
                checks[0]["details"].get("restored") is not True):
            raise RuntimeError(f"full process command did not pass: {capture_id}: {checks}")
        detail = checks[0]["details"]
        record = {"command_id": command_id, "capture_id": capture_id,
                  "capture_sha256": capture["sha256"], **detail}
        with log.open("a", encoding="utf-8") as file:
            file.write(json.dumps(record, sort_keys=True) + "\n")
        print(f"verified {capture_id}: map {detail['map_index']}/"
              f"{detail['map_total']} offset {detail['map_offset']} "
              f"uploaded {detail['bytes']} bytes", flush=True)
        if detail["done"]:
            print("all measured readable mappings uploaded", flush=True)
            return
    print("command budget reached; resume with another invocation", flush=True)


if __name__ == "__main__":
    main()
