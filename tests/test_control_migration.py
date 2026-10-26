from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest

from fw14lab.control import connect


class ControlMigrationTests(unittest.TestCase):
    def test_existing_session_and_command_survive_runner_upgrade(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "state.sqlite3"
            with closing(sqlite3.connect(path)) as old:
                old.executescript("""
                    CREATE TABLE sessions (
                        id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL,
                        firmware_label TEXT NOT NULL, user_agent TEXT NOT NULL,
                        created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL
                    );
                    CREATE TABLE commands (
                        id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
                        action TEXT NOT NULL, status TEXT NOT NULL,
                        attempt INTEGER NOT NULL DEFAULT 0, attempt_token_hash TEXT,
                        served_build_sha256 TEXT, queued_at TEXT NOT NULL,
                        claimed_at TEXT, finished_at TEXT, capture_id TEXT,
                        capture_sha256 TEXT, capture_received_at TEXT
                    );
                    INSERT INTO sessions VALUES (
                        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'secret', '14.00',
                        'PlayStation 4/14.00', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z'
                    );
                    INSERT INTO commands (id,session_id,action,status,queued_at,capture_id)
                    VALUES ('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                            'baseline_repeat_v1', 'completed',
                            '2026-10-18T00:00:00Z', 'cccccccccccccccccccccccccccccccc');
                """)
                old.commit()
            with closing(connect(path)) as upgraded:
                session = upgraded.execute("SELECT id,runner_version FROM sessions").fetchone()
                command = upgraded.execute(
                    "SELECT capture_id,source_sha256 FROM commands").fetchone()
                self.assertEqual(session["id"], "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
                self.assertEqual(session["runner_version"], 0)
                self.assertEqual(command["capture_id"], "cccccccccccccccccccccccccccccccc")
                self.assertIsNone(command["source_sha256"])


if __name__ == "__main__":
    unittest.main()
