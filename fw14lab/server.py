"""Small HTTP collector for local, browser-only observations."""

from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
from pathlib import Path
import re
import threading
from urllib.parse import urlsplit

from . import SCHEMA_VERSION
from .captures import InvalidSubmission, MAX_BODY_BYTES, save_capture, validate_submission
from .bulk_dump import save_chunk
from .control import ControlError, claim, complete, connect, get_claimed_probe, mark_probe, register_session
from .probe_blobs import ProbeError

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = PROJECT_ROOT / "web"
CAPTURE_ROOT = PROJECT_ROOT / "captures"
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/probes.js": ("probes.js", "text/javascript; charset=utf-8"),
    "/sha256.js": ("sha256.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}
PROBE_ROUTE = re.compile(r"/api/commands/([0-9a-f]{32})/probe\Z")
VIDEOCORE_ROUTE = re.compile(r"/oracle/videocore/([0-9a-f]{32})\.mp4\Z")
VIDEOCORE_FIXTURE_PATH = PROJECT_ROOT / "assets" / "videocore_fixture.mp4"


def reject_json_constant(value: str):
    raise InvalidSubmission(f"non-finite JSON number: {value}")


def make_handler(capture_root: Path, db_path: Path | None = None,
                 bulk_root: Path | None = None,
                 videocore_oracle_root: Path | None = None):
    db_path = db_path or PROJECT_ROOT / "control" / "state.sqlite3"
    bulk_root = bulk_root or PROJECT_ROOT / "evidence" / "live" / "bulk_chunks"
    videocore_oracle_root = (videocore_oracle_root or PROJECT_ROOT / "evidence" /
                             "live" / "videocore_oracle")
    videocore_oracle_root.mkdir(parents=True, exist_ok=True)
    videocore_oracle_lock = threading.Lock()
    videocore_fixture = VIDEOCORE_FIXTURE_PATH.read_bytes()
    with closing(connect(db_path)):
        pass
    asset_bytes = {path: (WEB_ROOT / filename).read_bytes()
                   for path, (filename, _) in ASSETS.items()}
    hasher = hashlib.sha256()
    for path in sorted(asset_bytes):
        hasher.update(path.encode("utf-8") + b"\0" + asset_bytes[path])
    served_build_sha256 = hasher.hexdigest()

    class Handler(BaseHTTPRequestHandler):
        def trusted_request(self) -> bool:
            host = self.headers.get("Host", "")
            try:
                parsed = urlsplit("http://" + host)
                hostname = parsed.hostname or ""
                if (not hostname or parsed.username is not None or
                        parsed.password is not None or parsed.path or parsed.query or
                        parsed.fragment or host.strip() != host):
                    raise ValueError("malformed host")
                if hostname != "localhost":
                    ipaddress.ip_address(hostname)
                if parsed.port != self.server.server_port:
                    raise ValueError("wrong host port")
            except ValueError:
                self.send_json(400, {"error": "invalid Host header"})
                return False
            origin = self.headers.get("Origin")
            if origin is not None and origin != "http://" + host:
                self.send_json(403, {"error": "cross-origin request rejected"})
                return False
            return True

        def send_json(self, status: int, value: dict) -> None:
            body = json.dumps(value, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def serve_videocore_oracle(self, token: str, head_only: bool) -> None:
            event = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "method": self.command,
                "path": self.path,
                "client": self.client_address[0],
                "range": self.headers.get("Range"),
                "user_agent": self.headers.get("User-Agent"),
            }
            line = (json.dumps(event, allow_nan=False, sort_keys=True)
                    .encode("utf-8") + b"\n")
            with videocore_oracle_lock:
                with (videocore_oracle_root / f"{token}.ndjson").open("ab") as stream:
                    stream.write(line)

            body = videocore_fixture
            start = 0
            end = len(body) - 1
            status = 200
            range_header = self.headers.get("Range")
            if range_header:
                match = re.fullmatch(r"bytes=(\d+)-(\d*)", range_header)
                if not match:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{len(body)}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                start = int(match.group(1))
                end = int(match.group(2)) if match.group(2) else end
                if start >= len(body) or end < start:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{len(body)}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                end = min(end, len(body) - 1)
                status = 206
            response_body = body[start:end + 1]
            self.send_response(status)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(len(response_body)))
            self.send_header("Cache-Control", "no-store")
            if status == 206:
                self.send_header("Content-Range",
                                 f"bytes {start}-{end}/{len(body)}")
            self.end_headers()
            if not head_only:
                self.wfile.write(response_body)

        def do_HEAD(self) -> None:
            if not self.trusted_request():
                return
            oracle_match = VIDEOCORE_ROUTE.fullmatch(self.path)
            if oracle_match:
                self.serve_videocore_oracle(oracle_match.group(1), True)
                return
            self.send_error(404)

        def do_GET(self) -> None:
            if not self.trusted_request():
                return
            if self.path == "/api/health":
                self.send_json(200, {"status": "ok", "schema_version": SCHEMA_VERSION,
                                     "served_build_sha256": served_build_sha256})
                return
            oracle_match = VIDEOCORE_ROUTE.fullmatch(self.path)
            if oracle_match:
                self.serve_videocore_oracle(oracle_match.group(1), False)
                return
            probe_match = PROBE_ROUTE.fullmatch(self.path)
            if probe_match:
                try:
                    source, sha256 = get_claimed_probe(
                        db_path, probe_match.group(1),
                        self.headers.get("X-FW14-Session", ""),
                        self.headers.get("X-FW14-Attempt", ""))
                except ControlError as error:
                    self.send_json(403, {"error": str(error)})
                    return
                except ProbeError as error:
                    self.send_json(409, {"error": str(error)})
                    return
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(source)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("X-FW14-Source-SHA256", sha256)
                self.end_headers()
                self.wfile.write(source)
                return
            asset = ASSETS.get(self.path)
            if asset is None:
                self.send_error(404)
                return
            _, content_type = asset
            body = asset_bytes[self.path]
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self) -> None:
            if not self.trusted_request():
                return
            if self.path not in {"/api/observations", "/api/sessions",
                                 "/api/commands/claim", "/api/commands/mark",
                                 "/api/commands/result", "/api/dump/chunk"}:
                self.send_error(404)
                return
            if self.headers.get_content_type() != "application/json":
                self.send_json(415, {"error": "expected application/json"})
                return
            try:
                length = int(self.headers.get("Content-Length", ""))
            except ValueError:
                self.send_json(411, {"error": "Content-Length required"})
                return
            if not 1 <= length <= MAX_BODY_BYTES:
                self.send_json(413, {"error": "observation size outside limit"})
                return
            try:
                value = json.loads(self.rfile.read(length),
                                   parse_constant=reject_json_constant)
                if self.path == "/api/observations":
                    submission = validate_submission(value)
                    if submission["schema_version"] != 1:
                        raise InvalidSubmission("command captures use the result endpoint")
                    receipt = save_capture(capture_root, submission)
                    self.send_json(201, receipt)
                    return
                if self.path == "/api/sessions":
                    required = {"firmware_label", "user_agent"}
                    if type(value) is not dict or set(value) not in (required, required | {"runner_version"}):
                        raise ControlError("invalid session fields")
                    session = register_session(db_path, value["firmware_label"],
                                               value["user_agent"], value.get("runner_version", 0))
                    self.send_json(201, session)
                    return
                if self.path == "/api/dump/chunk":
                    receipt = save_chunk(bulk_root, db_path,
                                         self.headers.get("X-FW14-Session", ""), value)
                    self.send_json(201, receipt)
                    return
                if type(value) is not dict or "session_id" not in value:
                    raise ControlError("session id required")
                session_id = value["session_id"]
                secret = self.headers.get("X-FW14-Session", "")
                if self.path == "/api/commands/claim":
                    if set(value) != {"session_id"}:
                        raise ControlError("invalid claim fields")
                    command = claim(db_path, session_id, secret, served_build_sha256)
                    self.send_json(200, {"command": command})
                    return
                if self.path == "/api/commands/mark":
                    payload = dict(value)
                    del payload["session_id"]
                    receipt = mark_probe(db_path, session_id, secret, payload)
                    self.send_json(201, receipt)
                    return
                payload = dict(value)
                del payload["session_id"]
                receipt = complete(db_path, capture_root, session_id, secret, payload)
                self.send_json(201, receipt)
            except (UnicodeDecodeError, json.JSONDecodeError, InvalidSubmission, ControlError) as error:
                self.send_json(400, {"error": str(error)})

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description="PS4 14.00 browser observation collector")
    parser.add_argument("--host", default="127.0.0.1", help="bind address; use 0.0.0.0 for a LAN console")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), make_handler(CAPTURE_ROOT))
    print(f"Serving http://{args.host}:{server.server_port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
