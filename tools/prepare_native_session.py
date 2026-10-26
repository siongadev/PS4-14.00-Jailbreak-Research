"""Prepare the current PS4 page's address-derived native caller in order.

Run from the project root with ``python tools/prepare_native_session.py ID``.
Every stage is a hash-pinned probe and must pass before the next is queued.
The script never reuses an address or caller from a previous page session.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fw14lab.control import DEFAULT_DB, enqueue_probe, list_commands, list_markers, list_sessions


CAPTURES = ROOT / "captures"
STAGES = (
    "clone_history_jsarray_storage_v1",
    "clone_history_inrange_anchor_groom_v6",
    "clone_history_typed_cell_spray_v3",
    "clone_history_typed_pair_setup_v2",
    "clone_history_native_call_plan_v12",
    "clone_history_worker_owned_plan_v6",
    "clone_history_native_invoke_install_v34",
)
WIDE_HISTORY_STAGE = "clone_history_jsarray_storage_v4"


def active_session(session_id: str) -> bool:
    for session in list_sessions(DEFAULT_DB):
        if session["id"] == session_id:
            seen = datetime.fromisoformat(session["last_seen_at"].replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - seen).total_seconds() < 15
    return False


def run_probe(session_id: str, name: str) -> dict:
    command_id = enqueue_probe(DEFAULT_DB, session_id, ROOT / "probes" / (name + ".json"))
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        row = next((item for item in list_commands(DEFAULT_DB)
                    if item["id"] == command_id), None)
        if row and row["status"] == "completed":
            capture = json.loads((CAPTURES / (row["capture_id"] + ".json")).read_text())
            check = capture["submission"]["checks"][0]
            return {"probe": name, "command": command_id,
                    "capture": row["capture_id"], "status": check["status"],
                    "details": check["details"]}
        time.sleep(0.5)
    return {"probe": name, "command": command_id, "status": "pending",
            "markers": list_markers(DEFAULT_DB, command_id)}


def current_session_pass(session_id: str, name: str) -> bool:
    """Allow resuming only from a verified capture on this exact page."""
    accepted = {name}
    if name == STAGES[0]:
        accepted.add(WIDE_HISTORY_STAGE)
    for row in list_commands(DEFAULT_DB):
        if (row["session_id"] != session_id or
                row["probe_id"] not in accepted or
                row["status"] != "completed" or not row["capture_id"]):
            continue
        capture = json.loads((CAPTURES / (row["capture_id"] + ".json")).read_text())
        if capture["submission"]["checks"][0]["status"] == "pass":
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session", help="new page's 32-character Connected as ID")
    parser.add_argument("--resume-after", choices=STAGES,
                        help="already-passed stage on this same page")
    args = parser.parse_args()
    if not active_session(args.session):
        parser.error("session is absent or has not polled within 15 seconds")
    if args.resume_after and not current_session_pass(args.session, args.resume_after):
        parser.error("resume stage has no passing capture on this page")
    past_resume = args.resume_after is None
    for name in STAGES:
        if not past_resume:
            if name == args.resume_after:
                past_resume = True
            continue
        outcome = run_probe(args.session, name)
        print(json.dumps(outcome, separators=(",", ":")), flush=True)
        if (name == STAGES[0] and outcome["status"] == "fail" and
                outcome.get("details", {}).get("view_valid") is True):
            outcome = run_probe(args.session, WIDE_HISTORY_STAGE)
            print(json.dumps(outcome, separators=(",", ":")), flush=True)
        if name == "clone_history_inrange_anchor_groom_v6":
            # A batch can have zero candidates or false-positive candidates.
            # v6 retains page-local roots and limits itself to four batches.
            while (outcome["status"] == "fail" and
                   outcome.get("details", {}).get("batch", 4) < 4):
                if not active_session(args.session):
                    return 1
                outcome = run_probe(args.session, name)
                print(json.dumps(outcome, separators=(",", ":")), flush=True)
        if (name == "clone_history_typed_pair_setup_v2" and
                outcome["status"] == "error" and
                outcome.get("details", {}).get("error", "").endswith(
                    "typed_cells_outside_window")):
            growth = run_probe(args.session, "clone_history_typed_cell_growth_v1")
            print(json.dumps(growth, separators=(",", ":")), flush=True)
            if growth["status"] != "pass":
                return 1
            outcome = run_probe(args.session, name)
            print(json.dumps(outcome, separators=(",", ":")), flush=True)
        if outcome["status"] != "pass":
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
