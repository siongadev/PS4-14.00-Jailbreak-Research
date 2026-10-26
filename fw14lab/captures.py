"""Validate and preserve browser observations without interpreting them."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import uuid

from . import SCHEMA_VERSION

MAX_BODY_BYTES = 16_384
CHECK_ID = re.compile(r"[a-z][a-z0-9_-]{0,63}\Z")
HEX_ID = re.compile(r"[0-9a-f]{32}\Z")
HEX_SHA256 = re.compile(r"[0-9a-f]{64}\Z")
STATUSES = frozenset({"pass", "fail", "unsupported", "error"})


class InvalidSubmission(ValueError):
    """A client observation does not meet the versioned input contract."""


def validate_submission(value: object) -> dict:
    if type(value) is not dict:
        raise InvalidSubmission("unexpected observation fields")
    version = value.get("schema_version")
    if type(version) is not int or version not in (1, 2, SCHEMA_VERSION):
        raise InvalidSubmission("unsupported schema version")
    base_fields = {"schema_version", "firmware_label", "user_agent", "client_time", "checks"}
    if set(value) != base_fields | ({"context"} if version >= 2 else set()):
        raise InvalidSubmission("unexpected observation fields")
    if value["firmware_label"] != "14.00":
        raise InvalidSubmission("this collector accepts the operator label 14.00 only")
    if type(value["user_agent"]) is not str or not 1 <= len(value["user_agent"]) <= 1024:
        raise InvalidSubmission("invalid user agent")
    if type(value["client_time"]) is not str or len(value["client_time"]) > 40:
        raise InvalidSubmission("invalid client time")
    try:
        timestamp = datetime.fromisoformat(value["client_time"].replace("Z", "+00:00"))
    except ValueError as error:
        raise InvalidSubmission("invalid client time") from error
    if timestamp.tzinfo is None:
        raise InvalidSubmission("client time needs a timezone")
    if version >= 2:
        context = value["context"]
        required = {"session_id", "command_id", "action", "attempt",
                    "served_build_sha256", "started_at", "completed_at"}
        if version == 3:
            required |= {"probe_id", "script_name", "source_sha256", "manifest_sha256",
                         "check_ids", "timeout_ms", "runner_version"}
        if type(context) is not dict or set(context) != required:
            raise InvalidSubmission("invalid command context")
        for key in ("session_id", "command_id"):
            if type(context[key]) is not str or not HEX_ID.fullmatch(context[key]):
                raise InvalidSubmission(f"invalid {key}")
        if type(context["action"]) is not str or not CHECK_ID.fullmatch(context["action"]):
            raise InvalidSubmission("invalid action")
        if version == 3 and context["action"] != "run_probe_v1":
            raise InvalidSubmission("version 3 requires a probe action")
        if type(context["attempt"]) is not int or not 1 <= context["attempt"] <= 100:
            raise InvalidSubmission("invalid attempt")
        if (type(context["served_build_sha256"]) is not str or
                not HEX_SHA256.fullmatch(context["served_build_sha256"])):
            raise InvalidSubmission("invalid served build digest")
        for key in ("started_at", "completed_at"):
            if type(context[key]) is not str or len(context[key]) > 40:
                raise InvalidSubmission(f"invalid {key}")
            try:
                observed_time = datetime.fromisoformat(context[key].replace("Z", "+00:00"))
            except ValueError as error:
                raise InvalidSubmission(f"invalid {key}") from error
            if observed_time.tzinfo is None:
                raise InvalidSubmission(f"{key} needs a timezone")
        if version == 3:
            if type(context["probe_id"]) is not str or not CHECK_ID.fullmatch(context["probe_id"]):
                raise InvalidSubmission("invalid probe id")
            if (type(context["script_name"]) is not str or
                    not re.fullmatch(r"[a-z][a-z0-9_-]{0,63}\.js", context["script_name"])):
                raise InvalidSubmission("invalid script name")
            for key in ("source_sha256", "manifest_sha256"):
                if type(context[key]) is not str or not HEX_SHA256.fullmatch(context[key]):
                    raise InvalidSubmission(f"invalid {key}")
            expected = context["check_ids"]
            if (type(expected) is not list or not 1 <= len(expected) <= 12 or
                    any(type(item) is not str or not CHECK_ID.fullmatch(item) for item in expected) or
                    len(set(expected)) != len(expected)):
                raise InvalidSubmission("invalid probe check ids")
            if type(context["timeout_ms"]) is not int or not 1000 <= context["timeout_ms"] <= 30_000:
                raise InvalidSubmission("invalid probe timeout")
            if context["runner_version"] != 1 or type(context["runner_version"]) is not int:
                raise InvalidSubmission("invalid runner version")
            manifest = {"probe_id": context["probe_id"], "script": context["script_name"],
                        "check_ids": expected, "timeout_ms": context["timeout_ms"]}
            manifest_json = json.dumps(manifest, sort_keys=True, separators=(",", ":"),
                                       ensure_ascii=False, allow_nan=False).encode("utf-8")
            if hashlib.sha256(manifest_json).hexdigest() != context["manifest_sha256"]:
                raise InvalidSubmission("probe manifest digest mismatch")
    checks = value["checks"]
    if type(checks) is not list or not 1 <= len(checks) <= 12:
        raise InvalidSubmission("expected 1 to 12 checks")
    seen: set[str] = set()
    for check in checks:
        if type(check) is not dict or set(check) != {"id", "status", "details"}:
            raise InvalidSubmission("unexpected check fields")
        identifier = check["id"]
        if type(identifier) is not str or not CHECK_ID.fullmatch(identifier) or identifier in seen:
            raise InvalidSubmission("invalid or duplicate check id")
        seen.add(identifier)
        if type(check["status"]) is not str or check["status"] not in STATUSES:
            raise InvalidSubmission("invalid check status")
        details = check["details"]
        if type(details) is not dict or len(details) > 12:
            raise InvalidSubmission("invalid check details")
        for key, item in details.items():
            if type(key) is not str or not CHECK_ID.fullmatch(key):
                raise InvalidSubmission("invalid detail key")
            if item is not None and type(item) not in (str, int, float, bool):
                raise InvalidSubmission("detail values must be scalar")
            if type(item) is float and not math.isfinite(item):
                raise InvalidSubmission("detail numbers must be finite")
            if type(item) is str and len(item) > 512:
                raise InvalidSubmission("detail string too long")
    return value


def submission_sha256(submission: dict) -> str:
    canonical = json.dumps(submission, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
                           allow_nan=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def save_capture(directory: Path, submission: dict) -> dict:
    """Write one immutable, server-identified record and return its receipt."""
    validate_submission(submission)
    directory.mkdir(parents=True, exist_ok=True)
    receipt = {
        "capture_id": uuid.uuid4().hex,
        "received_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sha256": submission_sha256(submission),
    }
    record = {**receipt, "submission": submission}
    path = directory / f"{receipt['capture_id']}.json"
    with path.open("x", encoding="utf-8", newline="\n") as file:
        json.dump(record, file, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())
    return receipt
