# ADR-0024: Terms of use accepted before the first request

- **Status:** Accepted
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §8; arch §5, §8; `TERMS.md`

## Context
LogicLens sends code to third-party AI providers. The project owner wants every user to agree, before any use, that the developers are not liable for damage arising from use, that the user is bound by their organization's IT and usage policies, and that the user will not use LogicLens on internal, confidential, highly confidential, eyes-only, or similarly classified code or documents. LogicLens cannot detect classification itself.

## Decision
- The full terms live in `TERMS.md` at the repository root, ship in the VSIX, and carry a version string.
- `RequestGate.send()` checks terms acceptance first, before workspace trust and the per-provider data notice (ADR-0014). If the current version is not accepted, it shows a modal with the key points and **I Agree**, **View Full Terms**, and Cancel. Only **I Agree** records acceptance; anything else sends nothing.
- Acceptance is stored in global state as `termsAccepted: { version, acceptedAt }`. A new terms version asks again. "Reset Data Notices" does not clear it.
- The prompt appears on the first explicit action, not on activation, so installing LogicLens never pops a modal.
- `logiclens.viewTerms` opens `TERMS.md` at any time.

## Alternatives considered
- Prompt on activation: interrupts users who have not tried the extension yet, and activation must stay quiet.
- Fold the terms into the per-provider data notice: the notice repeats per provider and is resettable; the agreement is a separate, one-time, versioned act.
- Rely on the Marketplace listing or a license file only: the user never explicitly agrees.

## Consequences
- One more modal on first use; the data notice follows it for the first provider.
- Integration test: no request is possible until terms are accepted, and a version bump asks again.
- The terms text is not legal advice and should be reviewed by a lawyer before S9.
