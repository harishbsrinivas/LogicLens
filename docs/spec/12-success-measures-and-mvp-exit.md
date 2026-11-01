# 12. Success Measures and MVP Exit

## Quality checks (before every release)

- Each Ready provider completes a walkthrough of the smoke file set (5 files) end to end.
- Structural evaluation (spec §10) runs for the default provider and meets targets below.
- No code is sent without an explicit action: integration test that opens, switches, and edits files with a fake provider and asserts zero requests.
- Exclusions, secret scan, and untrusted-workspace behavior covered by integration tests.
- Rendering tests: model output containing `<script>`, `<img onerror>`, images, `javascript:` and `command:` links, and HTML comments renders inert in the inline explanation (ADR-0028).
- Keyboard-only run of J1, J3, and J5. Screen reader spot check (Orca on Linux; NVDA and VoiceOver come with S13).
- Light, dark, and high-contrast theme screenshots reviewed.
- Package size under 2 MB (VSIX), activation under 50 ms of extension-host time measured with the Developer: Show Running Extensions view.

## MVP exit criteria

- J1 to J8 (spec §2) work in VS Code stable on Linux (ADR-0026) with VS Code Language Models on the GitHub Copilot Free plan and with Claude Code (ADR-0025).
- Secret scan fixtures: every known-format fixture is withheld, and the false-positive fixture set of normal code flags no more than 1 line in 1,000.
- Structural targets on the evaluation set with the default provider: parse rate ≥ 95%, anchor rate ≥ 90%, coverage ≥ 80% at `standard` depth.
- Human review average ≥ 4.0 for correctness and ≥ 4.0 for clarity on a 20-file sample.
- First overview text visible within 5 seconds median on the smoke set with the default provider (excludes provider cold start for CLIs, reported separately).
- Published to the VS Code Marketplace (Linux x64 and arm64 builds) with a listing, screenshots, privacy statement, and a short demo GIF.
- All items in `SECURITY.md` pre-merge checklist hold for the release build.

## Success measures (after launch)

No telemetry, so these come from public signals and opt-in feedback:

- Marketplace installs, rating, and review themes (Open VSX from S7).
- Issue tracker: ratio of explanation-quality issues to bugs, time to first response.
- A "Was this helpful?" thumbs action on the explanation thread that, in the MVP, only opens a prefilled GitHub issue when the user chooses to; nothing is sent automatically.
- Provider mix reported voluntarily in issues, to decide which adapters deserve investment.
