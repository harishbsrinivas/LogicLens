# S13. Windows and macOS

**Status:** Not started
**User value:** users on Windows and macOS can install LogicLens from the Marketplace and use it with Copilot Free and Claude Code.
**Spec:** §9 (macOS keybindings), §11, §12
**Note:** post-release. The MVP is VS Code stable on Linux only (ADR-0026). Independent of S7.

## Scope

In:
- Claude Code on Windows: binary resolution (`claude.cmd` shims, `PATH`, `logiclens.cli.claudePath`), process-tree kill, stdin encoding; on macOS: GUI `PATH` differences.
- Path handling review: exclusions and `.logiclensignore` with backslash paths and drive letters; case-insensitive file systems.
- Verify macOS keybindings in spec §9 against VS Code defaults.
- Accessibility spot checks with NVDA (Windows) and VoiceOver (macOS).
- CI: unit and integration jobs on `windows-latest` and `macos-latest`.
- Release: add `win32-x64`, `win32-arm64`, `darwin-x64`, `darwin-arm64` targets, or switch to one universal VSIX.

Out: forks and Open VSX (S7).

## Tasks

- [ ] Spike: Claude Code headless invocation on Windows and macOS; record in arch §4 and ADR-0005.
- [ ] `cli/spawn.ts` Windows handling with unit tests; stub-CLI integration test on Windows CI.
- [ ] Exclusion matcher tests with Windows paths.
- [ ] CI matrix for Windows and macOS.
- [ ] Release targets updated in arch §9 and the publish job.

## Demo script

1. On Windows and on macOS, install LogicLens from the Marketplace.
2. Run the S1, S2, S4, and S6 demo scripts with Copilot Free and with Claude Code.
3. Press Stop during a Claude Code request; the CLI process tree exits.

## Exit check

- [ ] Demo script passes on Windows and macOS.
- [ ] All tests green on Linux, Windows, and macOS CI.
- [ ] Marketplace listing offers Windows and macOS builds.
