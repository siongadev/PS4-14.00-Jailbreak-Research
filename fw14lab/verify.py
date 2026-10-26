"""Verify the stored digest and input contract of one capture file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

from .captures import InvalidSubmission, submission_sha256, validate_submission

CAPTURE_ID = re.compile(r"[0-9a-f]{32}\Z")


def verify_capture(path: Path) -> dict:
    record = json.loads(path.read_text(encoding="utf-8"))
    if type(record) is not dict or set(record) != {
        "capture_id", "received_at", "sha256", "submission"
    }:
        raise ValueError("invalid capture fields")
    if type(record["capture_id"]) is not str or not CAPTURE_ID.fullmatch(record["capture_id"]):
        raise ValueError("invalid capture id")
    if path.stem != record["capture_id"]:
        raise ValueError("filename does not match capture id")
    if type(record["sha256"]) is not str or not re.fullmatch(r"[0-9a-f]{64}", record["sha256"]):
        raise ValueError("invalid sha256 field")
    validate_submission(record["submission"])
    if submission_sha256(record["submission"]) != record["sha256"]:
        raise ValueError("capture submission digest mismatch")
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify one PS4 browser capture")
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    try:
        record = verify_capture(args.path)
    except (OSError, ValueError, json.JSONDecodeError, InvalidSubmission) as error:
        parser.exit(1, f"Verification failed: {error}\n")
    print(f"Verified {record['capture_id']} ({record['sha256']})")


if __name__ == "__main__":
    main()
