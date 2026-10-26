"""Verify and extract a completed 14.00 LNC GPU-status method capture.

The method result alone is not a sandbox escape. This tool only preserves
the exact 0x524-byte response and reports its integrity and basic shape.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.lnc_response_capture import verify_response


CHECK_IDS = ["lnc_gpu_status_v1"] + [f"lnc_gpu_bytes_{i}" for i in range(6)]
OUTPUT_SIZE = 0x524


def extract(record: dict) -> tuple[bytes, dict]:
    return verify_response(
        record, probe_id="clone_history_lnc_gpu_status_v1",
        check_ids=CHECK_IDS, output_size=OUTPUT_SIZE,
        zero_fields=("control_ret", "raw_ret", "raw_errno", "sys_result",
                     "method_result"),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path, help="collector capture JSON")
    parser.add_argument("--out", type=Path, required=True,
                        help="path for verified raw response bytes")
    args = parser.parse_args()
    record = json.loads(args.capture.read_text(encoding="utf-8"))
    data, report = extract(record)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(data)
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
