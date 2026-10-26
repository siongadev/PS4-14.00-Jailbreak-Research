import json
import tempfile
import unittest
from pathlib import Path

from fw14lab.captures import InvalidSubmission, save_capture, validate_submission
from fw14lab.verify import verify_capture


def sample_submission():
    return {
        "schema_version": 1,
        "firmware_label": "14.00",
        "user_agent": "Test browser",
        "client_time": "2026-10-18T12:00:00.000Z",
        "checks": [
            {"id": "typed_array_basic", "status": "pass", "details": {"actual": "18,52,86"}},
            {"id": "message_channel_basic", "status": "pass", "details": {"matched": True}},
        ],
    }


class CaptureTests(unittest.TestCase):
    def test_valid_submission_and_immutable_capture(self):
        submission = validate_submission(sample_submission())
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            first = save_capture(directory, submission)
            second = save_capture(directory, submission)
            self.assertNotEqual(first["capture_id"], second["capture_id"])
            saved = json.loads((directory / f"{first['capture_id']}.json").read_text())
            self.assertEqual(saved["submission"], submission)
            self.assertEqual(saved["sha256"], second["sha256"])
            self.assertEqual(len(list(directory.glob("*.json"))), 2)
            self.assertEqual(verify_capture(directory / f"{first['capture_id']}.json"), saved)

    def test_tampered_capture_fails_verification(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            receipt = save_capture(directory, sample_submission())
            path = directory / f"{receipt['capture_id']}.json"
            record = json.loads(path.read_text(encoding="utf-8"))
            record["submission"]["checks"][0]["status"] = "fail"
            path.write_text(json.dumps(record), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                verify_capture(path)

    def test_rejects_wrong_firmware_and_duplicate_check(self):
        wrong = sample_submission()
        wrong["firmware_label"] = "13.00"
        with self.assertRaises(InvalidSubmission):
            validate_submission(wrong)
        duplicate = sample_submission()
        duplicate["checks"][1]["id"] = duplicate["checks"][0]["id"]
        with self.assertRaises(InvalidSubmission):
            validate_submission(duplicate)

    def test_rejects_unbounded_or_misleading_values(self):
        cases = []
        unknown = sample_submission()
        unknown["claim"] = "kernel read/write"
        cases.append(unknown)
        bad_status = sample_submission()
        bad_status["checks"][0]["status"] = ["pass"]
        cases.append(bad_status)
        nonfinite = sample_submission()
        nonfinite["checks"][0]["details"]["value"] = float("nan")
        cases.append(nonfinite)
        long_text = sample_submission()
        long_text["checks"][0]["details"]["actual"] = "x" * 513
        cases.append(long_text)
        for case in cases:
            with self.subTest(case=repr(case)[:80]), self.assertRaises(InvalidSubmission):
                validate_submission(case)


if __name__ == "__main__":
    unittest.main()
