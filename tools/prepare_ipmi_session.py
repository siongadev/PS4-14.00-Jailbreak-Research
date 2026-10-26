"""Prepare one freshly connected 14.00 page for source-checked IPMI probes.

Every stage must pass on the same page. The native installer derives module
addresses from that page's census and map rather than prior captures.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys

from prepare_native_session import active_session, current_session_pass, run_probe


ROOT = Path(__file__).resolve().parents[1]
BASE_FINAL = "clone_history_native_invoke_install_v31"
FOLLOW_UP = (
    "clone_history_bulk_module_census_v2",
    "clone_history_bulk_map_census_v3",
    "clone_history_native_invoke_install_v49",
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session", help="new page's 32-character Connected as ID")
    args = parser.parse_args()
    if not active_session(args.session):
        parser.error("session is absent or has not polled within 15 seconds")

    if not current_session_pass(args.session, BASE_FINAL):
        base = subprocess.run(
            [sys.executable, str(ROOT / "tools/prepare_native_session.py"),
             args.session],
            check=False,
        )
        if base.returncode != 0:
            return base.returncode

    for name in FOLLOW_UP:
        if current_session_pass(args.session, name):
            print(json.dumps({"probe": name, "status": "already_passed"}), flush=True)
            continue
        if not active_session(args.session):
            print(json.dumps({"probe": name, "status": "page_disconnected"}), flush=True)
            return 1
        outcome = run_probe(args.session, name)
        print(json.dumps(outcome, separators=(",", ":")), flush=True)
        if outcome["status"] != "pass":
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
