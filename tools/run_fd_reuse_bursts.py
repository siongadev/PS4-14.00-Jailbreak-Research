"""Run sequential PS4 fd-reuse write bursts and stop on the first anomaly."""

import argparse
import json
import sqlite3
import time
from pathlib import Path

from fw14lab.control import DEFAULT_DB, enqueue_probe


def command_status(command_id: str) -> tuple[str, str | None]:
    with sqlite3.connect(DEFAULT_DB) as db:
        row = db.execute(
            "SELECT status,capture_id FROM commands WHERE id=?", (command_id,)
        ).fetchone()
    return row[0], row[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session", required=True)
    parser.add_argument("--count", type=int, default=8)
    parser.add_argument("--manifest", type=Path,
                        default=Path("probes/clone_history_worker_fd_reuse_burst_v1.json"))
    args = parser.parse_args()
    totals = {"attempted": 0, "old_signals": 0, "replacement_signals": 0,
              "worker_success": 0, "worker_ebadf": 0}
    for number in range(1, args.count + 1):
        command_id = enqueue_probe(DEFAULT_DB, args.session, args.manifest)
        deadline = time.monotonic() + 50
        while True:
            status, capture_id = command_status(command_id)
            if status == "completed":
                break
            if time.monotonic() >= deadline:
                print(json.dumps({"burst": number, "command_id": command_id,
                                  "status": status, "error": "wait_timeout"}), flush=True)
                return
            time.sleep(0.25)
        path = Path("captures") / f"{capture_id}.json"
        check = json.loads(path.read_text())["submission"]["checks"][0]
        details = check.get("details", {})
        for key in totals:
            totals[key] += details.get(key, 0)
        print(json.dumps({"burst": number, "command_id": command_id,
                          "capture_id": capture_id, "status": check["status"],
                          "details": details}), flush=True)
        expected_check = json.loads(args.manifest.read_text())["check_ids"][0]
        if (check["id"] != expected_check or check["status"] != "pass" or
                details.get("anomaly_at") != -1):
            break
    print(json.dumps({"totals": totals}), flush=True)


if __name__ == "__main__":
    main()
