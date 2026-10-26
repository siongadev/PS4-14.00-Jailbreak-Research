"""Durable queue for named, bounded browser diagnostics.

Only this local CLI can enqueue. The HTTP server can register sessions, claim
queued commands, and record their results, but has no enqueue endpoint.
"""

from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
from pathlib import Path
import re
import secrets
import sqlite3
import uuid

from .actions import ACTIONS, validate_action_checks
from .captures import HEX_ID, InvalidSubmission, save_capture, validate_submission
from .probe_blobs import ProbeError, read_probe_blob, snapshot_probe

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = PROJECT_ROOT / "control" / "state.sqlite3"
MARKER_PHASE = re.compile(r"[a-z][a-z0-9_]{0,31}\Z")


class ControlError(ValueError):
    """Invalid session, command transition, or result."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA busy_timeout=5000")
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            secret_hash TEXT NOT NULL,
            firmware_label TEXT NOT NULL,
            user_agent TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            runner_version INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS commands (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            action TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('queued','claimed','completed')),
            attempt INTEGER NOT NULL DEFAULT 0,
            attempt_token_hash TEXT,
            served_build_sha256 TEXT,
            queued_at TEXT NOT NULL,
            claimed_at TEXT,
            finished_at TEXT,
            capture_id TEXT,
            capture_sha256 TEXT,
            capture_received_at TEXT,
            cancelled_at TEXT,
            probe_id TEXT,
            script_name TEXT,
            source_sha256 TEXT,
            manifest_sha256 TEXT,
            check_ids_json TEXT,
            timeout_ms INTEGER
        );
        CREATE INDEX IF NOT EXISTS commands_queue ON commands(session_id,status,queued_at);
        CREATE TABLE IF NOT EXISTS command_markers (
            id INTEGER PRIMARY KEY,
            command_id TEXT NOT NULL REFERENCES commands(id),
            attempt INTEGER NOT NULL,
            phase TEXT NOT NULL,
            received_at TEXT NOT NULL,
            UNIQUE(command_id,attempt,phase)
        );
    """)
    migrations = {
        "sessions": {"runner_version": "INTEGER NOT NULL DEFAULT 0"},
        "commands": {
            "probe_id": "TEXT", "script_name": "TEXT", "source_sha256": "TEXT",
            "manifest_sha256": "TEXT",
            "check_ids_json": "TEXT", "timeout_ms": "INTEGER",
            "cancelled_at": "TEXT",
        },
    }
    for table, additions in migrations.items():
        present = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})")}
        for column, definition in additions.items():
            if column not in present:
                connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    connection.commit()
    return connection


def register_session(db_path: Path, firmware_label: str, user_agent: str,
                     runner_version: int = 0) -> dict:
    if firmware_label != "14.00" or type(user_agent) is not str or not 1 <= len(user_agent) <= 1024:
        raise ControlError("invalid session identity")
    if type(runner_version) is not int or runner_version not in (0, 1):
        raise ControlError("invalid runner version")
    session_id = uuid.uuid4().hex
    secret = secrets.token_urlsafe(32)
    now = utc_now()
    with closing(connect(db_path)) as connection:
        connection.execute(
            "INSERT INTO sessions (id,secret_hash,firmware_label,user_agent,created_at,"
            "last_seen_at,runner_version) VALUES (?,?,?,?,?,?,?)",
            (session_id, digest(secret), firmware_label, user_agent, now, now, runner_version))
        connection.commit()
    return {"session_id": session_id, "session_secret": secret}


def authenticate(connection: sqlite3.Connection, session_id: str, secret: str) -> sqlite3.Row:
    if (type(session_id) is not str or len(session_id) != 32 or
            type(secret) is not str or not 1 <= len(secret) <= 128):
        raise ControlError("invalid session credentials")
    row = connection.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
    if row is None or not hmac.compare_digest(row["secret_hash"], digest(secret)):
        raise ControlError("unknown session or secret")
    return row


def list_sessions(db_path: Path) -> list[dict]:
    with closing(connect(db_path)) as connection:
        rows = connection.execute(
            "SELECT id,firmware_label,user_agent,created_at,last_seen_at,runner_version "
            "FROM sessions ORDER BY last_seen_at DESC LIMIT 20").fetchall()
        return [dict(row) for row in rows]


def enqueue(db_path: Path, session_id: str, action: str) -> str:
    if action not in ACTIONS:
        raise ControlError("unknown action")
    if action == "run_probe_v1":
        raise ControlError("use enqueue-probe for a local probe")
    return queue_command(db_path, session_id, action)


def queue_command(db_path: Path, session_id: str, action: str,
                  probe: tuple[dict, str, str] | None = None) -> str:
    if type(session_id) is not str or not HEX_ID.fullmatch(session_id):
        raise ControlError("invalid session id")
    with closing(connect(db_path)) as connection:
        connection.execute("BEGIN IMMEDIATE")
        session = connection.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        if session is None:
            raise ControlError("unknown session")
        last_seen = datetime.fromisoformat(session["last_seen_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - last_seen > timedelta(seconds=45):
            raise ControlError("session has not polled in the last 45 seconds")
        if "PlayStation 4/14.00" not in session["user_agent"]:
            raise ControlError("session user agent is not the observed PS4 14.00 form")
        if probe is not None and session["runner_version"] != 1:
            raise ControlError("session needs the updated probe runner")
        command_id = uuid.uuid4().hex
        manifest, source_sha256, manifest_sha256 = probe if probe is not None else (None, None, None)
        connection.execute(
            "INSERT INTO commands (id,session_id,action,status,queued_at,probe_id,"
            "script_name,source_sha256,manifest_sha256,check_ids_json,timeout_ms) "
            "VALUES (?,?,?,'queued',?,?,?,?,?,?,?)",
            (command_id, session_id, action, utc_now(),
             manifest["probe_id"] if manifest else None,
             manifest["script"] if manifest else None, source_sha256, manifest_sha256,
             json.dumps(manifest["check_ids"]) if manifest else None,
             manifest["timeout_ms"] if manifest else None))
        connection.commit()
    return command_id


def enqueue_probe(db_path: Path, session_id: str, manifest_path: Path) -> str:
    probe = snapshot_probe(manifest_path, db_path.parent / "probe_blobs")
    return queue_command(db_path, session_id, "run_probe_v1", probe)


def cancel_queued(db_path: Path, command_id: str) -> dict:
    """Retire an unclaimed command while retaining its queue record."""
    if type(command_id) is not str or not HEX_ID.fullmatch(command_id):
        raise ControlError("invalid command id")
    with closing(connect(db_path)) as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT status,cancelled_at FROM commands WHERE id=?", (command_id,)
        ).fetchone()
        if row is None:
            raise ControlError("unknown command")
        if row["status"] != "queued":
            raise ControlError("only an unclaimed command can be cancelled")
        cancelled_at = row["cancelled_at"] or utc_now()
        if row["cancelled_at"] is None:
            connection.execute(
                "UPDATE commands SET cancelled_at=? WHERE id=? AND status='queued'",
                (cancelled_at, command_id),
            )
        connection.commit()
        return {"command_id": command_id, "cancelled_at": cancelled_at}


def claim(db_path: Path, session_id: str, secret: str, served_build_sha256: str) -> dict | None:
    with closing(connect(db_path)) as connection:
        connection.execute("BEGIN IMMEDIATE")
        authenticate(connection, session_id, secret)
        now = utc_now()
        connection.execute("UPDATE sessions SET last_seen_at=? WHERE id=?", (now, session_id))
        row = connection.execute(
            "SELECT id,action,attempt,probe_id,source_sha256,manifest_sha256,"
            "check_ids_json,timeout_ms FROM commands "
            "WHERE session_id=? AND status='queued' AND cancelled_at IS NULL "
            "ORDER BY queued_at,id LIMIT 1",
            (session_id,)).fetchone()
        if row is None:
            connection.commit()
            return None
        attempt = row["attempt"] + 1
        attempt_token = secrets.token_urlsafe(32)
        connection.execute(
            "UPDATE commands SET status='claimed',attempt=?,attempt_token_hash=?,"
            "served_build_sha256=?,claimed_at=? WHERE id=?",
            (attempt, digest(attempt_token), served_build_sha256, now, row["id"]))
        connection.commit()
        command = {"command_id": row["id"], "action": row["action"],
                   "attempt": attempt, "attempt_token": attempt_token}
        if row["action"] == "run_probe_v1":
            command.update({"probe_id": row["probe_id"],
                            "source_sha256": row["source_sha256"],
                            "manifest_sha256": row["manifest_sha256"],
                            "check_ids": json.loads(row["check_ids_json"]),
                            "timeout_ms": row["timeout_ms"]})
        return command


def get_claimed_probe(db_path: Path, command_id: str, secret: str,
                      attempt_token: str) -> tuple[bytes, str]:
    if type(command_id) is not str or not HEX_ID.fullmatch(command_id):
        raise ControlError("invalid command id")
    if type(attempt_token) is not str or not 1 <= len(attempt_token) <= 128:
        raise ControlError("invalid attempt token")
    with closing(connect(db_path)) as connection:
        row = connection.execute("SELECT * FROM commands WHERE id=?", (command_id,)).fetchone()
        if row is None or row["action"] != "run_probe_v1" or row["status"] != "claimed":
            raise ControlError("probe command is not claimed")
        authenticate(connection, row["session_id"], secret)
        if not hmac.compare_digest(row["attempt_token_hash"], digest(attempt_token)):
            raise ControlError("wrong attempt token")
        source = read_probe_blob(row["source_sha256"], db_path.parent / "probe_blobs")
        return source, row["source_sha256"]


def mark_probe(db_path: Path, session_id: str, secret: str, payload: object) -> dict:
    required = {"command_id", "attempt", "attempt_token", "phase"}
    if type(payload) is not dict or set(payload) != required:
        raise ControlError("invalid marker fields")
    command_id = payload["command_id"]
    phase = payload["phase"]
    if (type(command_id) is not str or not HEX_ID.fullmatch(command_id) or
            type(payload["attempt"]) is not int or not 1 <= payload["attempt"] <= 100 or
            type(payload["attempt_token"]) is not str or
            not 1 <= len(payload["attempt_token"]) <= 128 or
            type(phase) is not str or not MARKER_PHASE.fullmatch(phase)):
        raise ControlError("invalid marker value")
    with closing(connect(db_path)) as connection:
        connection.execute("BEGIN IMMEDIATE")
        authenticate(connection, session_id, secret)
        row = connection.execute(
            "SELECT * FROM commands WHERE id=? AND session_id=?",
            (command_id, session_id)).fetchone()
        if (row is None or row["status"] != "claimed" or
                row["action"] != "run_probe_v1" or
                row["attempt"] != payload["attempt"] or
                not hmac.compare_digest(row["attempt_token_hash"] or "",
                                        digest(payload["attempt_token"]))):
            raise ControlError("marker command is not a claimed probe attempt")
        existing = connection.execute(
            "SELECT received_at FROM command_markers WHERE command_id=? AND attempt=? AND phase=?",
            (command_id, payload["attempt"], phase)).fetchone()
        if existing is not None:
            return {"phase": phase, "received_at": existing["received_at"]}
        count = connection.execute(
            "SELECT COUNT(*) FROM command_markers WHERE command_id=? AND attempt=?",
            (command_id, payload["attempt"])).fetchone()[0]
        if count >= 8:
            raise ControlError("marker count exceeded")
        now = utc_now()
        connection.execute(
            "INSERT INTO command_markers (command_id,attempt,phase,received_at) VALUES (?,?,?,?)",
            (command_id, payload["attempt"], phase, now))
        connection.commit()
        return {"phase": phase, "received_at": now}


def list_markers(db_path: Path, command_id: str) -> list[dict]:
    if type(command_id) is not str or not HEX_ID.fullmatch(command_id):
        raise ControlError("invalid command id")
    with closing(connect(db_path)) as connection:
        rows = connection.execute(
            "SELECT attempt,phase,received_at FROM command_markers WHERE command_id=? ORDER BY id",
            (command_id,)).fetchall()
        return [dict(row) for row in rows]


def complete(db_path: Path, capture_root: Path, session_id: str, secret: str,
             payload: object) -> dict:
    required = {"command_id", "action", "attempt", "attempt_token",
                "started_at", "completed_at", "client_time", "checks"}
    if type(payload) is not dict or set(payload) != required:
        raise ControlError("invalid command result fields")
    if (type(payload["command_id"]) is not str or len(payload["command_id"]) != 32 or
            type(payload["action"]) is not str or payload["action"] not in ACTIONS or
            type(payload["attempt"]) is not int or not 1 <= payload["attempt"] <= 100 or
            type(payload["attempt_token"]) is not str or
            not 1 <= len(payload["attempt_token"]) <= 128):
        raise ControlError("invalid command identity")
    with closing(connect(db_path)) as connection:
        connection.execute("BEGIN IMMEDIATE")
        session = authenticate(connection, session_id, secret)
        row = connection.execute("SELECT * FROM commands WHERE id=? AND session_id=?",
                                 (payload["command_id"], session_id)).fetchone()
        if row is None:
            raise ControlError("unknown command or attempt")
        if not hmac.compare_digest(row["attempt_token_hash"] or "", digest(payload["attempt_token"])):
            raise ControlError("wrong attempt token")
        if row["action"] != payload["action"] or row["attempt"] != payload["attempt"]:
            raise ControlError("command identity mismatch")
        if row["status"] == "completed":
            return {"capture_id": row["capture_id"], "sha256": row["capture_sha256"],
                    "received_at": row["capture_received_at"]}
        if row["status"] != "claimed":
            raise ControlError("command was not claimed")
        expected_probe_checks = (json.loads(row["check_ids_json"])
                                 if row["action"] == "run_probe_v1" else None)
        validate_action_checks(row["action"], payload["checks"], expected_probe_checks)
        is_probe = row["action"] == "run_probe_v1"
        context = {
            "session_id": session_id,
            "command_id": row["id"],
            "action": row["action"],
            "attempt": row["attempt"],
            "served_build_sha256": row["served_build_sha256"],
            "started_at": payload["started_at"],
            "completed_at": payload["completed_at"],
        }
        if is_probe:
            context.update({
                "probe_id": row["probe_id"],
                "script_name": row["script_name"],
                "source_sha256": row["source_sha256"],
                "manifest_sha256": row["manifest_sha256"],
                "check_ids": expected_probe_checks,
                "timeout_ms": row["timeout_ms"],
                "runner_version": session["runner_version"],
            })
        submission = validate_submission({
            "schema_version": 3 if is_probe else 2,
            "firmware_label": session["firmware_label"],
            "user_agent": session["user_agent"],
            "client_time": payload["client_time"],
            "checks": payload["checks"],
            "context": context,
        })
        receipt = save_capture(capture_root, submission)
        now = utc_now()
        connection.execute(
            "UPDATE commands SET status='completed',finished_at=?,capture_id=?,capture_sha256=?,"
            "capture_received_at=? WHERE id=?",
            (now, receipt["capture_id"], receipt["sha256"], receipt["received_at"], row["id"]))
        connection.execute("UPDATE sessions SET last_seen_at=? WHERE id=?", (now, session_id))
        connection.commit()
        return receipt


def list_commands(db_path: Path) -> list[dict]:
    with closing(connect(db_path)) as connection:
        rows = connection.execute(
            "SELECT id,session_id,action,status,attempt,queued_at,claimed_at,finished_at,"
            "capture_id,capture_sha256,probe_id,source_sha256,cancelled_at FROM commands "
            "ORDER BY queued_at DESC,id DESC LIMIT 30"
        ).fetchall()
        commands = [dict(row) for row in rows]
        for command in commands:
            if command["status"] == "queued" and command["cancelled_at"]:
                command["status"] = "cancelled"
        return commands


def main() -> None:
    parser = argparse.ArgumentParser(description="Local control for the PS4 browser session")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("sessions", help="show recent browser sessions")
    sub.add_parser("commands", help="show recent queued and completed commands")
    markers = sub.add_parser("markers", help="show authenticated milestones for one probe command")
    markers.add_argument("--command-id", required=True)
    actions = sub.add_parser("actions", help="show allowed diagnostics")
    queue = sub.add_parser("enqueue", help="queue one diagnostic for an active PS4 session")
    queue.add_argument("--session", required=True)
    queue.add_argument("--action", choices=sorted(ACTIONS), required=True)
    probe_queue = sub.add_parser("enqueue-probe", help="queue a local, hash-pinned probe")
    probe_queue.add_argument("--session", required=True)
    probe_queue.add_argument("--manifest", type=Path, required=True)
    cancel = sub.add_parser("cancel-queued", help="retire an unclaimed command")
    cancel.add_argument("--command-id", required=True)
    args = parser.parse_args()
    try:
        if args.command == "sessions":
            result = list_sessions(DEFAULT_DB)
        elif args.command == "commands":
            result = list_commands(DEFAULT_DB)
        elif args.command == "markers":
            result = list_markers(DEFAULT_DB, args.command_id)
        elif args.command == "actions":
            result = ACTIONS
        elif args.command == "enqueue-probe":
            result = {"command_id": enqueue_probe(DEFAULT_DB, args.session, args.manifest)}
        elif args.command == "cancel-queued":
            result = cancel_queued(DEFAULT_DB, args.command_id)
        else:
            result = {"command_id": enqueue(DEFAULT_DB, args.session, args.action)}
    except (ControlError, ProbeError, OSError) as error:
        parser.exit(1, f"Control error: {error}\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
