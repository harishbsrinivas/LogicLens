# S6. Claude Code and Codex

**Status:** Not started
**User value:** users who have Claude Code or the Codex CLI signed in can use them for walkthroughs and questions without Copilot and without giving Clarity an API key.
**Spec:** §6 (Claude Code, Codex rows)

## Scope

In:
- `cli/spawn.ts` shared helper: argument arrays, `shell: false`, isolated cwd under global storage, minimal env, stdin prompt, line reader, stderr cap, timeout, output cap, kill tree on cancel, Windows `.cmd` shim handling.
- `claude-code` adapter: invocation verified in S0; parse the stream format into text chunks and usage; map errors.
- `codex` adapter: same.
- Path settings `clarity.cli.claudePath`, `clarity.cli.codexPath` (machine scope) and `clarity.cli.timeoutSeconds`.
- Detection via `--version`; "Needs sign-in" detection from the first failure if the CLI has no status command.
- Setup view and picker entries with install links.
- If a CLI cannot run with tools disabled, mark it "agentic", exclude from `auto`, and add to its data notice (ADR-0005).

## Tasks

- [ ] `cli/spawn.ts` with unit tests using a fake child process (timeouts, cancel, caps, stderr).
- [ ] Stream parsers for each CLI with recorded fixture outputs (success, auth error, rate limit, truncated).
- [ ] Integration test that runs a stub CLI script on `PATH` to exercise spawn end to end on Linux and Windows CI.
- [ ] Verify the isolated cwd: the CLI does not read workspace instruction files and cannot write to the workspace (manual check with a canary file, recorded in arch §4).
- [ ] Run the eval corpus with each CLI; record parse and anchor rates in arch §4.

## Demo script

1. Disable Copilot. Install and sign in to Claude Code.
2. Open the picker; Claude Code shows Ready. Pick it; accept its data notice.
3. Explain a Rust file; walkthrough streams; footer shows "Claude Code · <model>".
4. Ask a question at a line; answer comes from Claude Code.
5. Repeat with Codex.
6. Press Stop during a request; the CLI process exits (check with a process monitor).

## Exit check

- [ ] Demo script passes on Linux and Windows.
- [ ] Canary check confirms no workspace reads or writes by the CLIs.
- [ ] Eval parse rate ≥ 90% for both.
- [ ] All tests green.
