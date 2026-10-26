"""Persist bounded, authenticated live mapping chunks from one probe claim."""

from __future__ import annotations

import base64
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re

from .control import ControlError, connect, get_claimed_probe


HEX_ID = re.compile(r"[0-9a-f]{32}\Z")
SEGMENTS = frozenset({"rx", "ro", "rw"})
MAX_CHUNK = 8192
MAX_RANGE = 1 << 28


def save_chunk(root: Path, db_path: Path, secret: str, value: object) -> dict:
    required = {"session_id", "command_id", "attempt_token", "pid",
                "module_handle", "segment_kind", "range_start", "range_size",
                "offset", "data_b64"}
    if type(value) is not dict or set(value) != required:
        raise ControlError("invalid dump chunk fields")
    session_id = value["session_id"]
    command_id = value["command_id"]
    if (type(session_id) is not str or not HEX_ID.fullmatch(session_id) or
            type(command_id) is not str or not HEX_ID.fullmatch(command_id)):
        raise ControlError("invalid dump identity")
    source, source_sha256 = get_claimed_probe(
        db_path, command_id, secret, value["attempt_token"])
    del source
    with closing(connect(db_path)) as connection:
        row = connection.execute(
            "SELECT session_id FROM commands WHERE id=?", (command_id,)
        ).fetchone()
    if row is None or row["session_id"] != session_id:
        raise ControlError("dump command session mismatch")
    for key in ("pid", "module_handle", "range_start", "range_size", "offset"):
        if type(value[key]) is not int:
            raise ControlError("invalid dump numeric field")
    if (not 1 <= value["pid"] <= 100000 or
            not 0 <= value["module_handle"] <= 0xFFFF or
            not 0x10000 <= value["range_start"] < 0x100000000000 or
            not 1 <= value["range_size"] <= MAX_RANGE or
            not 0 <= value["offset"] < value["range_size"] or
            type(value["segment_kind"]) is not str or
            value["segment_kind"] not in SEGMENTS or
            type(value["data_b64"]) is not str):
        raise ControlError("dump range outside limits")
    try:
        data = base64.b64decode(value["data_b64"], validate=True)
    except (ValueError, base64.binascii.Error) as error:
        raise ControlError("invalid dump encoding") from error
    if not 1 <= len(data) <= MAX_CHUNK or value["offset"] + len(data) > value["range_size"]:
        raise ControlError("dump chunk exceeds range")
    digest = hashlib.sha256(data).hexdigest()
    directory = root / session_id / command_id
    directory.mkdir(parents=True, exist_ok=True)
    stem = f"{value['offset']:08x}"
    binary = directory / f"{stem}.bin"
    metadata = directory / f"{stem}.json"
    record = {key: value[key] for key in required - {"attempt_token", "data_b64"}}
    record.update({"bytes": len(data), "sha256": digest,
                   "source_sha256": source_sha256})
    if binary.exists() or metadata.exists():
        if (not binary.exists() or not metadata.exists() or
                binary.read_bytes() != data or
                json.loads(metadata.read_text(encoding="utf-8")) != record):
            raise ControlError("dump chunk conflicts with existing capture")
        return {"bytes": len(data), "sha256": digest, "duplicate": True}
    temporary = directory / f"{stem}.tmp"
    with temporary.open("xb") as file:
        file.write(data)
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary, binary)
    metadata.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return {"bytes": len(data), "sha256": digest, "duplicate": False}
