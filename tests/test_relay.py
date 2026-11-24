import os
from pathlib import Path
import pty
import select
import subprocess
import time
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
RELAY = str(ROOT / "scripts/claude-relay")


class RelayTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.home = Path(directory.name)
        self.env = {"HOME": directory.name, "PATH": os.environ["PATH"], "TMPDIR": directory.name,
                    "CLAUDE_CLI_BIN": str(ROOT / "tests/fixtures/mock-claude.py"),
                    "ANTHROPIC_API_KEY": "fixture-must-not-be-used"}
        for account in ("alpha", "bravo"):
            self.cli("--login", account)
        self.cli("--enroll", "alpha", "bravo")

    def cli(self, *args, success=True):
        result = subprocess.run([RELAY, *args], env=self.env, cwd=self.home,
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode == 0, success, result.stderr)
        return result.stdout + result.stderr

    def terminal(self, scenario, *args, success=True):
        self.env["SCENARIO"] = scenario
        master, slave = pty.openpty()
        with subprocess.Popen([RELAY, *args], env=self.env, cwd=self.home, stdin=slave,
                              stdout=slave, stderr=slave) as process:
            os.close(slave)
            output = bytearray()
            sent_draft = False
            deadline = time.monotonic() + 15
            try:
                while time.monotonic() < deadline:
                    if scenario == "draft" and not sent_draft and list(self.home.glob("claude-relay-*/stop.json")):
                        os.write(master, b"unfinished prompt")
                        sent_draft = True
                    if select.select([master], [], [], 0.1)[0]:
                        chunk = os.read(master, 8192)
                        if not chunk:
                            break
                        output.extend(chunk)
                    elif process.poll() is not None:
                        break
                self.assertEqual(process.wait(timeout=1) == 0, success, output.decode(errors="replace"))
                if scenario == "draft":
                    self.assertTrue(sent_draft)
            finally:
                if process.poll() is None:
                    process.kill()
                os.close(master)
        return self.home / "handoff"

    def test_login_and_duplicate_enrollment(self):
        self.assertIn("bravo", self.cli("--check"))
        self.env["SCENARIO"] = "duplicate"
        self.assertIn("同一账号", self.cli("--enroll", "alpha", "bravo", success=False))
        del self.env["SCENARIO"]
        self.assertIn("alpha", self.cli("--check"))

    def test_expired_and_unrecognized_quota(self):
        for scenario, message in [("expired", "登录无效"), ("malformed", "无法确认")]:
            self.env["SCENARIO"] = scenario
            self.assertIn(message, self.cli("--check", success=False))

    def test_five_hour_boundary(self):
        self.assertIn("/profiles/alpha/projects/", self.terminal("five-hour").read_text())

    def test_weekly_boundary(self):
        self.assertTrue(self.terminal("weekly").exists())

    def test_background_work_prevents_rotation(self):
        self.assertFalse(self.terminal("busy").exists())

    def test_draft_prevents_rotation(self):
        self.assertFalse(self.terminal("draft").exists())

    def test_six_percent_stays_on_current_account(self):
        self.assertFalse(self.terminal("above").exists())

    def test_no_eligible_account(self):
        self.assertFalse(self.terminal("all-low", success=False).exists())
        self.assertFalse((self.home / "running").exists())

    def test_resume_uses_switched_account_and_saved_transcript(self):
        self.terminal("five-hour")
        sessions = self.home / ".config/claude-code-on-mac/relay/sessions"
        saved, = sessions.glob("*.json")
        handoff = self.terminal("five-hour", "--resume", saved.stem)
        self.assertIn("/profiles/bravo/projects/", handoff.read_text())

    def test_restricted_account_blocks_next_turn(self):
        self.assertFalse(self.terminal("failure").exists())
        self.assertTrue((self.home / "blocked").exists())


if __name__ == "__main__":
    unittest.main()
