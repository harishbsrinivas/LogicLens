# ADR-0007: Line-tagged text protocol for walkthrough output

- **Status:** Proposed (confirm in S0 spike)
- **Date:** 2026-11-01
- **Deciders:** Project owner
- **Source:** spec §4, §10; arch §5

## Context
Walkthroughs need structure (overview, steps with line ranges, summary) and must stream. Providers differ: some support JSON schema or tool calls, CLIs wrap output in their own envelopes, local models follow JSON poorly. Partial JSON is awkward to render progressively.

## Decision
Ask every model for a plain-text format with `@@` tag lines (`@@overview`, `@@step N | L12-L20 | Title`, `@@concepts`, `@@summary`, `@@watch`, `@@end`), parsed incrementally by a pure, unit-tested parser. Fall back to plain Markdown when unparseable.

## Alternatives considered
- JSON mode or structured outputs: not available uniformly; streaming partial JSON is complex; a single syntax error loses everything.
- Tool calls per step: only some providers; CLIs don't expose them.
- NDJSON per step: step body cannot stream until the line ends.

## Consequences
- Same parser for every provider.
- Step headers render before bodies finish.
- Prompt must teach the format with an example; parse rate is tracked in the evaluation set.
