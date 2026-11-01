# ADR-0026: MVP targets VS Code on Linux only

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §11, §12; arch §1, §9; plan S0, S1, S6, S9, S13. Supersedes ADR-0012.

## Context
The plan asked every slice's demo and the release matrix to cover Linux plus Windows or macOS, and published to Open VSX for VS Code forks (ADR-0012). Development and testing happen on one Linux machine with VS Code. Windows and macOS checks (CLI path resolution and `.cmd` shims for Claude Code, keybindings, screen readers) and fork checks (does `vscode.lm` exist, which engine they ship) cannot be done there, so they would block slice exit checks without adding value to the first users. ADR-0025 already moved fork compatibility to S7.

## Decision
The MVP (S0 to S11, released in S9) supports one platform and one editor:

1. **Linux** (x64 and arm64). Demo scripts, manual checks, and CI run on Linux only.
2. **VS Code stable** (Microsoft build, engine floor per ADR-0017). No fork is tested or claimed.

Release (S9) publishes to the **VS Code Marketplace only**, as platform-specific VSIXs (`vsce package --target linux-x64` and `linux-arm64`), so the Marketplace does not offer LogicLens to Windows or macOS users. Open VSX publishing moves to S7 with the fork checks. Windows and macOS support moves to a new post-release slice, S13.

Code stays portable where it costs nothing (forward-slash path normalization, feature-detecting `vscode.lm`), but no Windows- or macOS-only code paths are written before S13.

## Alternatives considered
- Keep Linux plus one of Windows or macOS for each slice: no test machine; would block every exit check.
- Ship a universal VSIX with Linux as the only tested platform: Windows and macOS users could install a build nobody has run there, and the Claude Code CLI spawn path is known to differ on Windows.
- Keep Open VSX in the MVP: its users are mostly on forks, which are not tested until S7.

## Consequences
- Slice exit checks and the S9 matrix name Linux and VS Code stable only. The screen reader spot check uses Orca.
- S6 drops Windows `.cmd` shim handling and Windows CI; S13 adds them.
- macOS keybindings stay in spec §9 for later but are not verified in the MVP.
- Two VSIXs per release instead of one; CI packages both targets.
- Fork users and Windows and macOS users have no supported build until S7 and S13. The listing and README say "Linux, VS Code" plainly.
- ADR-0012 is superseded; its Open VSX and fork commitments resume in S7.
