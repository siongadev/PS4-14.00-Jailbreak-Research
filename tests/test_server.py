import base64
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from fw14lab.control import (ControlError, cancel_queued, enqueue,
                             enqueue_probe, list_commands, list_markers)
from fw14lab.probe_blobs import PROBE_ROOT
from fw14lab.server import make_handler
from fw14lab.verify import verify_capture
from tests.test_captures import sample_submission


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.db_path = self.directory / "control" / "state.sqlite3"
        self.videocore_oracle_root = (self.directory / "evidence" / "live" /
                                      "videocore_oracle")
        self.server = ThreadingHTTPServer(("127.0.0.1", 0),
                                          make_handler(self.directory, self.db_path,
                                                       self.directory / "evidence" /
                                                       "live" / "bulk_chunks",
                                                       self.videocore_oracle_root))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        self.temp.cleanup()

    def post(self, body: bytes, path="/api/observations", headers=None):
        all_headers = {"Content-Type": "application/json"}
        all_headers.update(headers or {})
        request = Request(self.base + path, body, all_headers, method="POST")
        return urlopen(request)

    def post_json(self, path, value, secret=None):
        headers = {"X-FW14-Session": secret} if secret else None
        with self.post(json.dumps(value).encode("utf-8"), path, headers) as response:
            return json.load(response)

    def test_serves_only_expected_assets(self):
        with urlopen(self.base + "/") as response:
            page = response.read()
            self.assertIn(b"PS4 LAB", page)
            self.assertIn(b"Firmware <strong>14.00</strong>", page)
            self.assertIn(b'id="remote-log"', page)
        with urlopen(self.base + "/api/health") as response:
            health = json.load(response)
            self.assertEqual(health["schema_version"], 3)
            self.assertEqual(len(health["served_build_sha256"]), 64)
        with urlopen(self.base + "/probes.js") as response:
            self.assertIn(b"runtime_inventory_v1", response.read())
        with urlopen(self.base + "/sha256.js") as response:
            self.assertIn(b"FW14_SHA256", response.read())
        with self.assertRaises(HTTPError) as error:
            urlopen(self.base + "/../fw14lab/server.py")
        self.assertEqual(error.exception.code, 404)

    def test_videocore_oracle_records_head_and_range_request(self):
        token = "0123456789abcdef0123456789abcdef"
        path = f"/oracle/videocore/{token}.mp4"
        with urlopen(Request(self.base + path, method="HEAD")) as response:
            self.assertEqual(response.status, 200)
            self.assertGreater(int(response.headers["Content-Length"]), 100_000)
            self.assertEqual(response.headers["Accept-Ranges"], "bytes")
        with urlopen(Request(self.base + path,
                             headers={"Range": "bytes=0-31"})) as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(len(response.read()), 32)
            self.assertTrue(response.headers["Content-Range"].startswith("bytes 0-31/"))
        events = [json.loads(line) for line in
                  (self.videocore_oracle_root / f"{token}.ndjson")
                  .read_text(encoding="utf-8").splitlines()]
        self.assertEqual([event["method"] for event in events], ["HEAD", "GET"])
        self.assertEqual(events[1]["range"], "bytes=0-31")

    def test_post_persists_one_raw_observation(self):
        body = json.dumps(sample_submission()).encode("utf-8")
        with self.post(body) as response:
            self.assertEqual(response.status, 201)
            receipt = json.load(response)
        saved = json.loads((self.directory / f"{receipt['capture_id']}.json").read_text())
        self.assertEqual(saved["submission"], sample_submission())
        self.assertEqual(saved["sha256"], receipt["sha256"])

    def test_invalid_body_creates_no_capture(self):
        for body in (b"{", b'{"schema_version":NaN}', b"x" * 16_385):
            with self.subTest(body=body[:20]), self.assertRaises(HTTPError):
                self.post(body)
        self.assertEqual(list(self.directory.glob("*.json")), [])

    def test_remote_command_is_claimed_once_and_saved_with_context(self):
        identity = self.post_json("/api/sessions", {
            "firmware_label": "14.00",
            "user_agent": "Mozilla/5.0 (PlayStation; PlayStation 4/14.00) test",
        })
        session_id = identity["session_id"]
        secret = identity["session_secret"]
        self.assertIsNone(self.post_json("/api/commands/claim",
                                         {"session_id": session_id}, secret)["command"])
        command_id = enqueue(self.db_path, session_id, "runtime_inventory_v1")

        def claim_once():
            return self.post_json("/api/commands/claim", {"session_id": session_id}, secret)["command"]

        with ThreadPoolExecutor(max_workers=2) as executor:
            claimed = list(executor.map(lambda _: claim_once(), range(2)))
        commands = [command for command in claimed if command]
        self.assertEqual(len(commands), 1)
        command = commands[0]
        self.assertEqual(command["command_id"], command_id)
        self.assertEqual(command["action"], "runtime_inventory_v1")
        result = {
            "session_id": session_id,
            "command_id": command_id,
            "action": command["action"],
            "attempt": command["attempt"],
            "attempt_token": command["attempt_token"],
            "started_at": "2026-10-18T12:01:00.000Z",
            "completed_at": "2026-10-18T12:01:01.000Z",
            "client_time": "2026-10-18T12:01:01.000Z",
            "checks": [{"id": "runtime_features", "status": "pass", "details": {
                "bigint": True, "webassembly": True, "shared_array_buffer": False,
                "structured_clone": False, "cross_origin_isolated": False,
            }}],
        }
        with self.assertRaises(HTTPError) as wrong_token:
            self.post_json("/api/commands/result", result, "wrong")
        self.assertEqual(wrong_token.exception.code, 400)
        receipt = self.post_json("/api/commands/result", result, secret)
        self.assertEqual(self.post_json("/api/commands/result", result, secret), receipt)
        records = list(self.directory.glob("*.json"))
        self.assertEqual(len(records), 1)
        saved = verify_capture(records[0])["submission"]
        self.assertEqual(saved["schema_version"], 2)
        self.assertEqual(saved["context"]["command_id"], command_id)
        self.assertEqual(saved["context"]["action"], "runtime_inventory_v1")
        self.assertEqual(len(saved["context"]["served_build_sha256"]), 64)

    def test_unclaimed_command_can_be_retired_without_losing_its_record(self):
        identity = self.post_json("/api/sessions", {
            "firmware_label": "14.00",
            "user_agent": "Mozilla/5.0 (PlayStation; PlayStation 4/14.00) test",
        })
        session_id = identity["session_id"]
        secret = identity["session_secret"]
        retired_id = enqueue(self.db_path, session_id, "runtime_inventory_v1")
        active_id = enqueue(self.db_path, session_id, "baseline_repeat_v1")
        retirement = cancel_queued(self.db_path, retired_id)
        self.assertEqual(cancel_queued(self.db_path, retired_id), retirement)
        command = self.post_json("/api/commands/claim",
                                 {"session_id": session_id}, secret)["command"]
        self.assertEqual(command["command_id"], active_id)
        self.assertIsNone(self.post_json("/api/commands/claim",
                                         {"session_id": session_id}, secret)["command"])
        self.assertEqual(next(item for item in list_commands(self.db_path)
                              if item["id"] == retired_id)["status"], "cancelled")
        with self.assertRaises(ControlError):
            cancel_queued(self.db_path, active_id)

    def test_control_rejects_untrusted_origin_and_result_shape(self):
        with self.assertRaises(HTTPError) as origin_error:
            self.post(b"{}", "/api/sessions", {"Origin": "http://example.com"})
        self.assertEqual(origin_error.exception.code, 403)
        with self.assertRaises(HTTPError) as no_enqueue:
            self.post(b"{}", "/api/commands/enqueue")
        self.assertEqual(no_enqueue.exception.code, 404)
        identity = self.post_json("/api/sessions", {
            "firmware_label": "14.00", "user_agent": "PlayStation 4/14.00",
        })
        malformed = {"session_id": identity["session_id"], "command_id": []}
        with self.assertRaises(HTTPError) as malformed_error:
            self.post_json("/api/commands/result", malformed, identity["session_secret"])
        self.assertEqual(malformed_error.exception.code, 400)

    def test_authenticated_dump_chunk_is_persisted_and_idempotent(self):
        identity = self.post_json("/api/sessions", {
            "firmware_label": "14.00", "user_agent": "PlayStation 4/14.00",
            "runner_version": 1,
        })
        session_id = identity["session_id"]
        secret = identity["session_secret"]
        command_id = enqueue_probe(self.db_path, session_id,
                                   PROBE_ROOT / "clone_graph_identity_v1.json")
        command = self.post_json("/api/commands/claim",
                                 {"session_id": session_id}, secret)["command"]
        self.assertEqual(command["command_id"], command_id)
        data = b"\0\x01\x02\xff"
        chunk = {"session_id": session_id, "command_id": command_id,
                 "attempt_token": command["attempt_token"], "pid": 74,
                 "module_handle": 48, "segment_kind": "ro",
                 "range_start": 0x80b278000, "range_size": 0x4000,
                 "offset": 0, "data_b64": base64.b64encode(data).decode("ascii")}
        with self.assertRaises(HTTPError):
            self.post_json("/api/dump/chunk", chunk, "wrong")
        receipt = self.post_json("/api/dump/chunk", chunk, secret)
        self.assertEqual(receipt["bytes"], len(data))
        self.assertEqual(receipt["sha256"], hashlib.sha256(data).hexdigest())
        self.assertFalse(receipt["duplicate"])
        self.assertTrue(self.post_json("/api/dump/chunk", chunk, secret)["duplicate"])
        stored = (self.directory / "evidence" / "live" / "bulk_chunks" /
                  session_id / command_id / "00000000.bin")
        self.assertEqual(stored.read_bytes(), data)
        chunk["data_b64"] = base64.b64encode(b"other").decode("ascii")
        with self.assertRaises(HTTPError):
            self.post_json("/api/dump/chunk", chunk, secret)

    def test_authenticated_dump_accepts_low_userland_mapping(self):
        identity = self.post_json("/api/sessions", {
            "firmware_label": "14.00", "user_agent": "PlayStation 4/14.00",
            "runner_version": 1,
        })
        session_id = identity["session_id"]
        secret = identity["session_secret"]
        command_id = enqueue_probe(self.db_path, session_id,
                                   PROBE_ROOT / "clone_graph_identity_v1.json")
        command = self.post_json("/api/commands/claim",
                                 {"session_id": session_id}, secret)["command"]
        chunk = {"session_id": session_id, "command_id": command_id,
                 "attempt_token": command["attempt_token"], "pid": 74,
                 "module_handle": 1, "segment_kind": "rx",
                 "range_start": 0x1e0e0000, "range_size": 0x8000,
                 "offset": 0, "data_b64": base64.b64encode(b"ELF").decode("ascii")}
        receipt = self.post_json("/api/dump/chunk", chunk, secret)
        self.assertEqual(receipt["bytes"], 3)
        chunk["range_start"] = 0
        with self.assertRaises(HTTPError):
            self.post_json("/api/dump/chunk", chunk, secret)

    def test_hash_pinned_probe_claim_fetch_and_capture(self):
        identity = self.post_json("/api/sessions", {
            "firmware_label": "14.00", "user_agent": "PlayStation 4/14.00",
            "runner_version": 1,
        })
        session_id = identity["session_id"]
        secret = identity["session_secret"]
        self.post_json("/api/commands/claim", {"session_id": session_id}, secret)
        command_id = enqueue_probe(self.db_path, session_id,
                                   PROBE_ROOT / "clone_graph_identity_v1.json")
        command = self.post_json("/api/commands/claim", {"session_id": session_id}, secret)["command"]
        self.assertEqual(command["command_id"], command_id)
        self.assertEqual(command["action"], "run_probe_v1")
        self.assertEqual(command["probe_id"], "clone_graph_identity_v1")
        probe_url = self.base + f"/api/commands/{command_id}/probe"
        with self.assertRaises(HTTPError) as wrong_attempt:
            urlopen(Request(probe_url, headers={"X-FW14-Session": secret,
                                                "X-FW14-Attempt": "wrong"}))
        self.assertEqual(wrong_attempt.exception.code, 403)
        with urlopen(Request(probe_url, headers={"X-FW14-Session": secret,
                                                 "X-FW14-Attempt": command["attempt_token"]})) as response:
            source = response.read()
            self.assertEqual(response.headers["X-FW14-Source-SHA256"],
                             command["source_sha256"])
            self.assertIn(b"identity_with_bigint", source)
        result = {
            "session_id": session_id, "command_id": command_id,
            "action": "run_probe_v1", "attempt": 1,
            "attempt_token": command["attempt_token"],
            "started_at": "2026-10-18T12:01:00.000Z",
            "completed_at": "2026-10-18T12:01:01.000Z",
            "client_time": "2026-10-18T12:01:01.000Z",
            "checks": [{"id": check_id, "status": "pass", "details": {}}
                       for check_id in command["check_ids"]],
        }
        receipt = self.post_json("/api/commands/result", result, secret)
        saved = verify_capture(self.directory / f"{receipt['capture_id']}.json")["submission"]
        self.assertEqual(saved["schema_version"], 3)
        self.assertEqual(saved["context"]["source_sha256"], command["source_sha256"])
        self.assertEqual(saved["context"]["manifest_sha256"], command["manifest_sha256"])
        self.assertEqual(saved["context"]["check_ids"], command["check_ids"])
        manifest_blob = self.db_path.parent / "probe_blobs" / f"{command['manifest_sha256']}.json"
        self.assertEqual(json.loads(manifest_blob.read_text())["script"],
                         saved["context"]["script_name"])

    def test_probe_marker_is_authenticated_durable_and_not_replayed(self):
        identity = self.post_json("/api/sessions", {
            "firmware_label": "14.00", "user_agent": "PlayStation 4/14.00",
            "runner_version": 1,
        })
        session_id = identity["session_id"]
        secret = identity["session_secret"]
        self.post_json("/api/commands/claim", {"session_id": session_id}, secret)
        command_id = enqueue_probe(self.db_path, session_id,
                                   PROBE_ROOT / "marker_round_trip_v1.json")
        command = self.post_json("/api/commands/claim", {"session_id": session_id}, secret)["command"]
        marker = {
            "session_id": session_id, "command_id": command_id,
            "attempt": command["attempt"], "attempt_token": command["attempt_token"],
            "phase": "before_constructor",
        }
        with self.assertRaises(HTTPError) as wrong_token:
            self.post_json("/api/commands/mark", {**marker, "attempt_token": "wrong"}, secret)
        self.assertEqual(wrong_token.exception.code, 400)
        receipt = self.post_json("/api/commands/mark", marker, secret)
        self.assertEqual(receipt["phase"], "before_constructor")
        self.assertEqual(self.post_json("/api/commands/mark", marker, secret), receipt)
        self.assertEqual(list_markers(self.db_path, command_id), [{
            "attempt": 1, "phase": "before_constructor", "received_at": receipt["received_at"]
        }])
        with self.assertRaises(HTTPError) as wrong_phase:
            self.post_json("/api/commands/mark", {**marker, "phase": "bad phase"}, secret)
        self.assertEqual(wrong_phase.exception.code, 400)
        result = {
            "session_id": session_id, "command_id": command_id,
            "action": "run_probe_v1", "attempt": 1,
            "attempt_token": command["attempt_token"],
            "started_at": "2026-10-18T12:01:00.000Z",
            "completed_at": "2026-10-18T12:01:01.000Z",
            "client_time": "2026-10-18T12:01:01.000Z",
            "checks": [{"id": "marker_round_trip", "status": "pass",
                        "details": {"phase": "before_constructor"}}],
        }
        self.post_json("/api/commands/result", result, secret)
        with self.assertRaises(HTTPError) as completed:
            self.post_json("/api/commands/mark", marker, secret)
        self.assertEqual(completed.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
