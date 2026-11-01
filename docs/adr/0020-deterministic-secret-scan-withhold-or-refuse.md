# ADR-0020: Deterministic local secret scan; withhold lines or refuse, never send

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §8; arch §5, §7, §8; SECURITY.md §1

## Context
User code often contains hardcoded credentials. The earlier spec offered **Send anyway**, **Send masked**, or **Cancel** on a scan hit, which leaves one click between a credential and a third-party model. Detecting secrets with an AI model would require sending the text to be checked, which defeats the purpose.

## Decision
- Secret detection is local and deterministic: regular expressions for known formats, private key block matching, credential-bearing URLs, and keyword-named assignments filtered by length and Shannon entropy, with an allowlist of documented placeholder values. No model is ever used for detection.
- On a hit, `logiclens.secrets.action` decides: `skip-lines` (default) replaces each flagged line in the outgoing text with a withheld marker that keeps the line number; `refuse-file` sends nothing. If withheld lines exceed 25% of the target's non-blank lines, the file is refused.
- There is no "send anyway" and no off value. The setting is application scope.
- The scan runs in `RequestGate` on the exact outgoing text, for walkthroughs, refreshes, and questions (including earlier thread turns and the typed question).
- Flagged lines are never written to logs, the webview, the cache, or bookmarks as text. Where re-anchoring needs line text, a withheld line is stored as a SHA-256 hash.

## Alternatives considered
- Keep "Send anyway": convenient on false positives, but makes leaking a key a single click.
- Mask only the matched value: keeps more context, but partial matches (a key split over a string concatenation) can leak the rest; withholding the whole line is simpler to reason about.
- AI-based detection: sends the secret to detect it, is non-deterministic, and cannot be unit tested reliably.
- A third-party scanner library (for example a gitleaks port): larger bundle and supply-chain surface for a pattern set small enough to own and test.

## Consequences
- False positives cost the model one line of context; the panel lists withheld lines so the user knows why a step is vague.
- The pattern set needs fixtures for every format and a false-positive corpus of normal code (spec §12 target: at most 1 flagged line in 1,000).
- Cache and bookmark re-anchoring compares hashes for withheld lines (ADR-0019 is unchanged otherwise).
- ADR-0014's gate order is unchanged; only the resolution options for the scan step change.
