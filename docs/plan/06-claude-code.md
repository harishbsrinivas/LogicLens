# S6. Claude Code

**Status:** Not started
**User value:** users who have Claude Code signed in can use it for walkthroughs and questions without Copilot and without giving LogicLens an API key.
**Spec:** §6 (Claude Code row)
**Note:** Codex moved to S7, after release (ADR-0025). `cli/spawn.ts` stays generic so S7 can reuse it.

## Scope

In:
- `cli/spawn.ts` shared helper: argument arrays, `shell: false`, isolated cwd under global storage, minimal env, stdin prompt, line reader, stderr cap, timeout, output cap, kill tree on cancel. Linux only (ADR-0026); Windows `.cmd` shim handling comes in S13.
- `claude-code` adapter: invocation verified in S0; parse the stream format into text chunks and usage; map errors.
- Path setting `logiclens.cli.claudePath` (machine scope) and `logiclens.cli.timeoutSeconds`.
- Detection via `--version`; "Needs sign-in" detection from the first failure if the CLI has no status command.
- Setup view and picker entries with install links.
- If a CLI cannot run with tools disabled, mark it "agentic", exclude from `auto`, and add to its data notice (ADR-0005).

## Tasks

- [ ] `cli/spawn.ts` with unit tests using a fake child process (timeouts, cancel, caps, stderr).
- [ ] Stream parser for Claude Code with recorded fixture outputs (success, auth error, rate limit, truncated).
- [ ] Integration test that runs a stub CLI script on `PATH` to exercise spawn end to end on Linux CI.
- [ ] Verify the isolated cwd: Claude Code does not read workspace instruction files and cannot write to the workspace (manual check with a canary file, recorded in arch §4).
- [ ] Run the eval corpus with Claude Code; record parse and anchor rates in arch §4.

## Demo script

1. Disable Copilot. Install and sign in to Claude Code.
2. Open the picker; Claude Code shows Ready. Pick it; accept its data notice.
3. Explain a Rust file; walkthrough streams; footer shows "Claude Code · <model>".
4. Ask a question at a line; answer comes from Claude Code.
5. Press Stop during a request; the CLI process exits (check with a process monitor).

## Exit check

- [ ] Demo script passes in VS Code stable on Linux (ADR-0026).
- [ ] Canary check confirms no workspace reads or writes by Claude Code.
- [ ] Eval parse rate ≥ 90%.
- [ ] All tests green.
