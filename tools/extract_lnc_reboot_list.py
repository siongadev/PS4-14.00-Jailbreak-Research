"""Verify and extract one 14.00 LNC app-status list response."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.lnc_response_capture import verify_response


SPECS = {
    "reboot_v3": ("clone_history_lnc_reboot_list_v3",
                  ["lnc_reboot_list_v3"] + [f"lnc_reboot_bytes_{i}" for i in range(5)],
                  0x42C),
    "local_v3": ("clone_history_lnc_local_list_v3",
                 ["lnc_local_list_v3", "lnc_local_bytes_0"], 0x24),
    "reboot_v2": ("clone_history_lnc_reboot_list_v2",
                  ["lnc_reboot_list_v2"] + [f"lnc_reboot_bytes_{i}" for i in range(5)],
                  0x42C),
    "local_v2": ("clone_history_lnc_local_list_v2",
                 ["lnc_local_list_v2", "lnc_local_bytes_0"], 0x24),
    "reboot": ("clone_history_lnc_reboot_list_v1",
               ["lnc_reboot_list_v1"] + [f"lnc_reboot_bytes_{i}" for i in range(5)],
               0x42C),
    "local": ("clone_history_lnc_local_list_v1",
              ["lnc_local_list_v1", "lnc_local_bytes_0"], 0x24),
}


def extract(record: dict, method: str = "reboot") -> tuple[bytes, dict]:
    probe_id, check_ids, output_size = SPECS[method]
    data, report = verify_response(
        record, probe_id=probe_id, check_ids=check_ids,
        output_size=output_size,
        zero_fields=("raw_ret", "raw_errno", "sys_result", "method_result"),
    )
    count = record["submission"]["checks"][0]["details"].get("out_count")
    if type(count) is not int or not 0 <= count <= 1:
        raise ValueError(f"returned entry count exceeds one-entry buffer: {count}")
    report["returned_entries"] = count
    report["method"] = method
    return data, report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path, help="collector capture JSON")
    parser.add_argument("--method", choices=tuple(SPECS), default="reboot")
    parser.add_argument("--out", type=Path, required=True,
                        help="path for verified raw list bytes")
    args = parser.parse_args()
    record = json.loads(args.capture.read_text(encoding="utf-8"))
    data, report = extract(record, args.method)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(data)
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
