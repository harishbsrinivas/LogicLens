# 5. Explanation Pipeline

```
command ─► resolve target ─► RequestGate ─► build context ─► render prompt ─► provider.stream
                                 │                                                   │
              terms · trust · exclude · notice                         text chunks    ▼
                     secret scan · size                       protocol parser (incremental)
                                                                        │ events
                                                                        ▼
                                                    anchor + validate ─► state store ─► inline threads, decorations
```

## 1. Resolve target

From the command arguments: document URI plus optional range (selection, symbol, or line). Selections expand to whole lines. Symbols come from `vscode.executeDocumentSymbolProvider`.

## 2. RequestGate

Single entry point for any provider call (arch §8). In order: current terms of use accepted (ADR-0024), workspace trusted, file not excluded, size within limits (spec §3), data notice acknowledged for this provider, secret scan (ADR-0020). The scan runs on the built context (step 3) before it leaves the gate: it either returns the text with flagged lines withheld, or refuses. Fails closed with a user-facing reason.

## 3. Build context

- Every line is prefixed with its absolute 1-based line number and a separator, for example `  42│ const x = 1;` (ADR-0010). Numbers are padded to equal width.
- For a selection, symbol, or line target, the target lines are wrapped in `<<<TARGET` / `TARGET>>>` marker lines, and surrounding file context is included with its own numbers.
- **Budget:** context is sized to the model's input limit when known (`countTokens` for `vscode-lm`, provider docs otherwise), capped at 24k input tokens by default. When over budget: keep the target whole, then the enclosing symbol, then nearest lines outward, with `… lines 120–380 omitted …` markers.
- Withheld lines (secret scan) keep their number: `  42│ «line withheld by LogicLens: possible secret»`. The header lists withheld line numbers.
- Header block: workspace-relative path, language ID, depth, audience, jargon, explanation language, withheld lines.

## 4. Prompt templates

Kept in `src/prompts/` as functions returning strings, each with a version constant included in the cache key.

- `walkthrough.system` (`prompts/walkthrough.ts`, v1 in S2): role, the quality rules from spec §10, the output protocol below with a short example, "explain, do not rewrite", "do not guess the content of withheld lines". Depth, audience, and jargon instructions arrive in S3. A unit test feeds the prompt's own example to the parser.
- `continue.user`: sent after the user turn and the earlier raw response (as the assistant turn) when the user chooses Continue; asks for the next step onward without repeating the overview.
- Personality fragment (S12, ADR-0023): appended last, after a fixed precedence line stating that protocol, ranges, facts, audience, and jargon override voice. `none` adds nothing.
- `question.system`: same rules, answer about the anchored lines, use `L<n>` for line references, may answer in free Markdown.
- `refreshSteps.system`: given the overview and changed steps' current code, rewrite only those steps.

Template text is reviewed like code; changes bump the version and rerun the evaluation set.

## 5. Walkthrough output protocol (ADR-0007)

Plain text, line-tagged. Every tag line starts with `@@` at column 0.

```
@@overview
One paragraph of Markdown.
@@step 1 | L12-L20,L31-L33 | Load configuration
Markdown explanation, any number of lines.
@@concepts environment variables; default parameters
@@step 2 | L22-L29 | Validate input
...
@@summary
- takeaway
- takeaway
@@watch
- edge case or risk
@@end
```

Rules:

- Ranges are `L<start>-L<end>`, comma-separated for multiple; a single line may be `L<n>`.
- Text between tags belongs to the preceding tag.
- Unknown tags are ignored. Text before the first tag is treated as overview if no `@@overview` appears.
- `@@end` marks a complete response; missing `@@end` at stream end means truncated (offer Continue).

Why not JSON: works identically across every provider, including CLIs that wrap output in their own envelopes; streams naturally (step header known before its body); tolerant of small model mistakes. Trade-off: a custom parser, covered by unit tests with malformed fixtures.

## 6. Incremental parser

`explain/protocol.ts` consumes text chunks, splits on newlines (buffering partial lines), and emits events:

- `overviewDelta(text)`
- `stepStart(index, ranges, title)` then `stepDelta(index, text)`
- `concepts(index, list)`
- `summaryDelta(text)`, `watchDelta(text)`
- `end()`

Text streams out as soon as a partial line cannot be a tag (it does not start with `@@`); a line that may be a tag is held until its newline. A trailing `\r` is held in case it is half of `\r\n`. Text before the first tag is held and becomes the overview only if the first tag is not `@@overview`. In `continuation` mode (Continue) text before the first tag is dropped and step indexes restart at 0; the service appends them after the existing steps. Step titles have `$(` neutralized, since they show in CodeLens.

It is a pure class over strings with no VS Code imports, so it is fully unit tested, including every split point of a sample response.

## 7. Anchor and validate

`explain/anchor.ts` checks each range against the document line count and the target range: clamp if within 2 lines of the target, otherwise mark unanchored (spec §4, §10). Kept ranges are sorted. Overlaps are allowed. Anchor, parse, and coverage rates are computed here (`measure`) for the evaluation runner (`pnpm eval`, arch §9).

## 7a. Settling a walkthrough

`explain/walkthrough.ts` applies parser events to the session as they arrive: new steps are anchored at once and are structural changes; text is a streamed change. While no tag has been seen, the raw text so far is shown as the Markdown fallback. When the stream ends:

- no tag at all: the raw text is the Markdown fallback with the "did not return steps" notice;
- steps with an empty title or text are dropped and the rest re-indexed;
- more than half of the steps unanchored: the overview and steps are composed into Markdown and shown with the "could not be tied to lines" notice;
- status is `stopped` (cancelled), `truncated` (structured but no `@@end`), `failed`, or `done`. `truncated` and `failed` walkthroughs with steps can be continued unless the file changed.

The raw response is kept in the session entry for Continue and logged only through the debug channel.

## 8. Questions

`explain/question.ts` builds messages from the thread history (oldest dropped first past budget), context per spec §5, and the related step. The response is free Markdown streamed into the comment. Line references `L<n>` or "line n" are turned into links by the renderer.

## 9. Refresh changed steps

Sends the overview, the changed steps' titles, and their current code (numbered). The response uses the same protocol with only those steps; the parser maps them back by step number.
