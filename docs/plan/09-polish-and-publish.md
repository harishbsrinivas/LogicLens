# S9. Polish and Publish

**Status:** Not started
**User value:** anyone can install LogicLens from the VS Code Marketplace or Open VSX, get oriented in a minute, and trust what it does with their code.
**Spec:** §7 (full visual and accessibility pass), §12 (quality checks and MVP exit criteria), §11

## Scope

In:
- Visual polish pass against spec §7: spacing, typography, motion with reduced-motion support, empty and error states, high-contrast review.
- Decide open decision 5 (snippet highlighting) by bundle size.
- Getting-started walkthrough (VS Code `walkthroughs` contribution): pick a provider, explain a file, ask at a line.
- "Was this helpful?" control that opens a prefilled GitHub issue only on user action.
- Keybinding review against VS Code defaults and popular keymaps; finalize spec §9.
- Full evaluation run and human review to MVP targets (spec §12).
- Performance: activation time, VSIX size, time to first overview.
- README with screenshots and GIF, privacy section (what is sent, where), provider setup guide, troubleshooting (including the multiple-commenting-provider picker).
- `CHANGELOG.md`, `LICENSE`, `SECURITY.md` contact set, Marketplace icon and gallery banner.
- Register the publisher ID and run the formal trademark search (ADR-0018).
- Legal review of `TERMS.md`; link it from the README and Marketplace listing (ADR-0024).
- CI publish job to Marketplace and Open VSX on tag, using environment-protected secrets.
- Manual matrix: VS Code stable and Insiders on Windows, macOS, Linux; Cursor and Kiro smoke tests.

## Tasks

- [ ] Accessibility audit with NVDA or VoiceOver; fix findings.
- [ ] Theme screenshots for light, dark, high contrast; fix findings.
- [ ] Eval: all 30–40 files, default provider; human review of 20.
- [ ] Publish dry run: `vsce package`, install the VSIX on a clean profile, run the full demo of S1 to S8, S10, and S11.
- [ ] Tag `v0.1.0` (pre-release channel), then `v1.0.0` when exit criteria hold.

## Exit check

- [ ] Every MVP exit criterion in spec §12 met and recorded in this file with numbers.
- [ ] Listed on the VS Code Marketplace and Open VSX.
- [ ] All tests green on the release tag.
