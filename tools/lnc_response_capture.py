"""Common integrity checks for chunked 14.00 LNC method responses."""

from __future__ import annotations

import hashlib
from pathlib import Path

from fw14lab.actions import validate_action_checks
from fw14lab.captures import submission_sha256, validate_submission
from fw14lab.probe_blobs import BLOB_ROOT, read_probe_blob


def verify_response(record: dict, *, probe_id: str, check_ids: list[str],
                    output_size: int, zero_fields: tuple[str, ...],
                    blob_root: Path = BLOB_ROOT) -> tuple[bytes, dict]:
    submission = record["submission"]
    validate_submission(submission)
    if record["sha256"] != submission_sha256(submission):
        raise ValueError("capture receipt hash mismatch")
    context = submission.get("context", {})
    if (context.get("probe_id") != probe_id or
            context.get("check_ids") != check_ids):
        raise ValueError("wrong pinned probe or check manifest")
    read_probe_blob(context["source_sha256"], blob_root)
    manifest_blob = blob_root / f"{context['manifest_sha256']}.json"
    manifest_bytes = manifest_blob.read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest() != context["manifest_sha256"]:
        raise ValueError("pinned manifest blob hash mismatch")

    checks = submission["checks"]
    validate_action_checks("run_probe_v1", checks, check_ids)
    summary = checks[0]
    details = summary["details"]
    if (summary["status"] != "pass" or not details.get("guard") or
            not details.get("restored")):
        raise ValueError("probe guard or restoration failed")
    for field in zero_fields:
        if details.get(field) != 0:
            raise ValueError(f"method did not succeed: {field}={details.get(field)}")
    chunks = []
    for check in checks[1:]:
        if check["status"] != "pass" or check["details"].get("available") is not True:
            raise ValueError(f"response chunk unavailable: {check['id']}")
        chunks.append(check["details"]["hex"])
    packed = "".join(chunks)
    if len(packed) != output_size * 2:
        raise ValueError("incomplete response")
    data = bytes.fromhex(packed)
    if details["prefix_hex"] != data[:64].hex():
        raise ValueError("response prefix disagrees with summary")
    changed = sum(byte != 0xA5 for byte in data)
    if details["changed"] != changed:
        raise ValueError("response changed-byte count disagrees with summary")
    fnv = 2166136261
    for byte in data:
        fnv = ((fnv ^ byte) * 16777619) & 0xFFFFFFFF
    if details["fnv32"] != fnv:
        raise ValueError("response FNV check disagrees with summary")
    report = {
        "capture_id": record["capture_id"],
        "session_id": context["session_id"],
        "source_sha256": context["source_sha256"],
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "changed_from_sentinel": changed,
        "nonzero_bytes": sum(byte != 0 for byte in data),
    }
    return data, report
