#!/usr/bin/env python3
"""Claude Code PostToolUse hook: auto-sync when TODO.md is edited.

Reads the hook JSON payload on stdin, and if the edited/written file is this
project's TODO.md, launches sync_todos.py in the background (non-blocking) and
exits immediately. Output goes to scripts/.sync.log. Always exits 0 so it never
blocks the editing tool.
"""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODO = os.path.join(ROOT, "TODO.md")
SYNC = os.path.join(ROOT, "scripts", "sync_todos.py")
LOG = os.path.join(ROOT, "scripts", ".sync.log")


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    fp = (data.get("tool_input") or {}).get("file_path", "")
    if not fp or os.path.abspath(fp) != os.path.abspath(TODO):
        return 0  # not our file — do nothing
    try:
        with open(LOG, "a") as lf:
            lf.write("\n--- auto-sync triggered ---\n")
            subprocess.Popen([sys.executable, SYNC], stdout=lf, stderr=lf,
                             start_new_session=True)
        print("↻ TODO.md changed — syncing to Google Sheet in background "
              "(see scripts/.sync.log)")
    except Exception as e:
        print(f"TODO auto-sync could not start: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
