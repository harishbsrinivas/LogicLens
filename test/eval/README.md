# Evaluation set

Structural evaluation of walkthroughs (spec §10). `corpus/` holds source files written for this project; `responses/<provider>/<file>.txt` holds raw model responses to them. `pnpm eval` parses each response with the extension's own parser and anchoring and reports:

- **parse rate:** responses that use the protocol and end with `@@end`,
- **anchor rate:** steps with at least one range inside the file (after clamping),
- **coverage:** non-blank lines inside some anchored step.

```sh
pnpm eval                         # every provider folder under responses/
pnpm eval copilot --min-parse 0.9 --min-anchor 0.85
```

It exits non-zero when a provider is below the minimums (defaults: the S2 exit check, 90% and 85%).

## Recording responses

Responses come from real providers, so they are recorded by hand and never in CI:

1. In an Extension Development Host, set `logiclens.debug.logPrompts` to `true`.
2. Open a corpus file and run **LogicLens: Explain File**.
3. Open the LogicLens output channel; copy the text after `[debug] response` into `responses/<provider>/<file name>.txt` (for example `responses/copilot/inventory.py.txt`).

Only corpus files are explained for the evaluation set, so no private code ends up in `responses/`.

The seed corpus has 10 files (S2); spec §10 grows it to 30–40 files across at least 10 languages before release.
