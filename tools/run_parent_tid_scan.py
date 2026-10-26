"""Run bounded signal-zero TID windows on a freshly calibrated page.

The probe derives the current parent PID and caller TID on the console.
This driver stops on any non-ESRCH response or failed capture.
"""

from __future__ import annotations

import argparse
import json

from prepare_native_session import active_session, run_probe


PROBE = "clone_history_thr_parent_tid_scan_v1"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session")
    parser.add_argument("--rounds", type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.rounds <= 16:
        parser.error("rounds must be between 1 and 16")
    for _ in range(args.rounds):
        if not active_session(args.session):
            parser.error("page stopped polling; no further probe queued")
        outcome = run_probe(args.session, PROBE)
        print(json.dumps(outcome, separators=(",", ":")), flush=True)
        if outcome["status"] != "pass":
            return 1
        detail = outcome["details"]
        if detail["hit"] >= 0 or detail["next"] < 100000:
            return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
