"""Build a compact index of captured 14.00 dual-thread AIO delete runs."""

import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from fw14lab.verify import verify_capture

CAPTURES = ROOT / "captures"
OUTPUT = ROOT / "docs" / "AIO_CONCURRENT_RUNS_14.json"


def main() -> None:
    runs = []
    for path in CAPTURES.glob("*.json"):
        capture = verify_capture(path)
        submission = capture.get("submission", {})
        context = submission.get("context", {})
        probe_id = context.get("probe_id", "")
        if not probe_id.startswith("clone_history_aio_dual_delete_v"):
            continue
        checks = submission.get("checks", [])
        check = checks[0] if checks else {}
        details = check.get("details", {})
        runs.append(
            {
                "capture_id": capture["capture_id"],
                "sha256": capture["sha256"],
                "received_at": capture["received_at"],
                "session_id": context.get("session_id"),
                "probe_id": probe_id,
                "status": check.get("status"),
                "classification": details.get("classification"),
                "page_per_id": details.get("page_per_id"),
                "worker_per_id": details.get("worker_per_id"),
                "post_cancel": details.get("post_cancel"),
                "sibling_post": details.get("sibling_post"),
                "cleanup_ok": details.get("cleanup_ok"),
            }
        )
    runs.sort(key=lambda run: (run["received_at"], run["capture_id"]))
    OUTPUT.write_text(
        json.dumps({"firmware": "14.00", "runs": runs}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Indexed {len(runs)} captures at {OUTPUT}")


if __name__ == "__main__":
    main()
