# 10. Explanation Quality

## What a good explanation does

1. **States intent before mechanics.** Why this code exists, then how.
2. **Follows the data.** Inputs, transformations, outputs, side effects (I/O, mutation, network, global state).
3. **Names the non-obvious.** Language features, framework conventions, implicit behavior (default arguments, hoisting, lifetimes, lazy evaluation), concurrency, error paths.
4. **Points at lines.** Every claim about behavior is tied to a step range or a line reference.
5. **Admits uncertainty.** When behavior depends on code not shown (an imported function, configuration), says so instead of guessing.
6. **Stays an explanation.** No rewrites, no "here's a better version" unless the user asks in a thread. Even then the answer is display-only.

These rules are encoded in the prompt templates (arch §5) and checked by the evaluation set below.

## Output contract

The model is asked for a structured walkthrough (arch §5 defines the schema). LogicLens validates each piece as it arrives:

- Line ranges must fall inside the target; out-of-range values are clamped if close (within 2 lines) and otherwise marked unanchored.
- Steps with an empty title or empty explanation are dropped when the response ends.
- If more than half of the steps cannot be tied to lines, the walkthrough is shown as Markdown in the overview block with the notice "Shown as plain text: most steps could not be tied to lines in this file."
- Unknown fields are ignored.
- If the response is not parseable as structured output at all, LogicLens shows it as Markdown with a notice ("Shown as plain text: the model did not return steps") and offers **Retry**.

## Evaluation set

A fixed corpus of 30 to 40 files across at least 10 languages (TypeScript, JavaScript, Python, Go, Rust, Java, C#, C/C++, Ruby, shell, SQL, YAML/Terraform), varied by size and style, lives in `test/eval/`. For each provider that reaches Ready in CI or locally:

- **Structural checks** (automated): parse rate, anchor rate (share of steps with valid ranges), coverage (share of non-blank lines inside some step), step count within the depth's range.
- **Human review** (before each minor release): a reviewer rates a sample for correctness, clarity, and usefulness on a 1–5 scale, using a short rubric in `test/eval/RUBRIC.md`.

Targets for MVP exit are in spec §12.

## Caching and staleness

- A walkthrough is cached by document URI, provider, model, depth, audience, jargon, personality, explanation language, prompt version, and target (whole file, or the selection's lines), together with the document's question threads. Only saved files are cached; untitled documents are not.
- Reopening a file shows its most recent cached walkthrough and threads instantly, without a request, labeled "Generated <time> ago" with the provider and model in the header. Threads keep only finished answers.
- **Close Explanation** also removes the document's cached walkthrough; closing the file does not.
- **When the file changes:**
  - Step ranges move with edits while the walkthrough is open (tracked like decorations).
  - A step whose lines were edited is marked **changed**; its text is kept and its title reads "(code changed)".
  - The walkthrough header shows "file changed since" once the file is edited, with **Refresh** (full, keeping the selection or symbol) and, when steps are marked, **Refresh changed steps** (sends the current file, the overview, and the changed steps' numbers, titles, and old ranges; only those steps are rewritten). When no marked steps remain, the walkthrough is no longer stale.
- On reopen after outside changes (git pull, another editor), LogicLens re-anchors steps by matching their original text; steps that cannot be found are marked changed.
- The cache holds the last walkthrough per document per settings combination and is capped at 50 MB per workspace, evicting least recently used.

## Failure handling

| Failure | Behavior |
|---|---|
| No provider ready | Setup view (spec §6) |
| Provider not signed in | Error with "Sign in" action that opens the provider's own flow |
| Timeout | Partial output kept; Retry |
| Rate limit or quota | Provider's message; Retry later |
| Cancelled by user | Partial output kept, marked "stopped" |
| Response not structured | Plain Markdown fallback with notice |
| File too large | Offer selection, visible range, or symbol (spec §3) |
| Excluded or secret file | Refuse with link to settings (spec §8) |
| Possible secrets in content | Withhold flagged lines, or refuse under `refuse-file` or above 25% withheld (spec §8) |
