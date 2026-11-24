#!/usr/bin/env python3
"""Offline Claude CLI fixture. Exercise the hook, registry, and PTY boundaries."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time
from uuid import uuid4


profile = Path(os.environ["CLAUDE_CONFIG_DIR"]).resolve()
account = profile.name
root = Path.home()
scenario = os.environ.get("SCENARIO", "five-hour")
args = sys.argv[1:]


def reply(obj):
    print(json.dumps(obj))
    sys.exit()


if args[:2] == ["auth", "login"]:
    assert os.environ["ANTHROPIC_API_KEY"] == ""
    (profile / "login").touch()
    sys.exit()
if args[:2] == ["auth", "status"]:
    identity = "same" if scenario == "duplicate" else account
    reply({"loggedIn": (profile / "login").exists() and scenario != "expired",
           "email": identity + "@example.invalid", "authMethod": "claude.ai",
           "apiProvider": "firstParty", "subscriptionType": "pro"})
if args[-1:] == ["/usage"]:
    if scenario == "malformed":
        reply({"result": "unknown format"})
    used = 95 if account == "alpha" and (root / "running").exists() else 10
    if scenario == "all-low":
        used = 99
    if scenario == "above":
        used = 94
    if scenario == "idle-recheck" and account == "alpha" and (root / "running").exists():
        observed = root / "already-checked"
        used = 95 if observed.exists() else 90
        observed.touch()
    if scenario == "during-check" and account == "alpha" and (root / "running").exists():
        (root / "checking").touch()
        time.sleep(0.6)
    five, week = (10, used) if scenario == "weekly" else (used, 10)
    reply({"result": f"Current session: {five}% used\nCurrent week (all models): {week}% used"})

settings = json.loads(args[args.index("--settings") + 1])
sid = str(uuid4())
transcript = profile / "projects" / "project" / (sid + ".jsonl")
transcript.parent.mkdir(parents=True, exist_ok=True)
transcript.write_text("test turn\n")
registry = profile / "sessions" / f"{os.getpid()}.json"
registry.parent.mkdir(exist_ok=True)
registry.write_text(json.dumps({"status": "idle", "sessionId": sid}))


def hook(event, **fields):
    invocation = settings["hooks"][event][0]["hooks"][0]["command"]
    return subprocess.run(shlex.split(invocation), input=json.dumps({
        "session_id": sid, "transcript_path": str(transcript), **fields
    }), text=True).returncode


hook("SessionStart")
if account == "bravo":
    old = Path(args[args.index("--resume") + 1])
    assert old.read_text() == "test turn\n"
    assert ("--fork-session" in args) == (profile not in old.parents)
    (root / "handoff").write_text(str(old))
    sys.exit()
(root / "running").touch()
hook("UserPromptSubmit")
if scenario == "failure":
    hook("StopFailure", error="account_on_hold")
hook("Stop", background_tasks=["running"] if scenario == "busy" else [], session_crons=[])
if scenario in {"busy", "failure", "above", "draft", "during-check"}:
    time.sleep(1.6)
    if scenario == "failure":
        assert hook("UserPromptSubmit") == 2
        (root / "blocked").touch()
    sys.exit()
time.sleep(80 if scenario == "idle-recheck" else 12)
