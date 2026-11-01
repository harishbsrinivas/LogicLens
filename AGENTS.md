# Agent Instructions

Rules for any AI coding agent (Claude Code, Codex, Cursor, Kiro, etc.) working in this repository. These are mandatory, not suggestions.

## 0. Reading the docs (keep context small)

Project docs live under `docs/`, one file per section, each folder with a `README.md` index. Do not read every file.

1. Read the four indexes: `docs/spec/README.md`, `docs/architecture/README.md`, `docs/adr/README.md`, `docs/plan/README.md`.
2. Open only the sections whose "Read when touching" paths or descriptions match the task, and only the ADRs whose tags or summaries match.
3. Skip Superseded ADRs unless you are tracing history.
4. `spec §N`, `arch §N`, and `plan S<N>` in code comments and ADRs mean file `NN-*.md` in that folder (`plan S3` is `docs/plan/03-*.md`).

## 1. Product specification comes first

- `docs/spec/` is the source of truth for what this extension does. Read its index before starting any task, then the relevant sections.
- No spec, no work. If a requested change is not covered by the spec, say so and update the affected section file in the same change. Update its index row if the section's scope changed.
- If a requested change contradicts the spec, point that out before writing code.

## 2. Work in slices

- `docs/plan/` lists the thin vertical slices in delivery order. Work on one slice at a time. Do not start a slice until the previous slice's exit check passes, unless the plan marks them as parallel.
- A slice is done only when its user-visible flow works end to end in a real VS Code Extension Development Host, its tests pass, and its exit check is ticked in the slice file.
- Update the slice file's **Status** line and the status table in `docs/plan/README.md` in the same change that finishes or starts a slice.
- Do not build ahead. Code for a later slice stays out until that slice starts, unless the plan explicitly pulls it forward.

## 3. Architecture documentation

- `docs/architecture/` describes how the extension is built: modules, provider adapters, the explanation pipeline, UI surfaces, storage, build, and release.
- Update the affected section file in the same change whenever you:
  - add, remove, or rename a module, provider adapter, command, view, or setting
  - change the explanation schema, prompt contract, or cache format
  - add or change an external integration (AI provider, CLI, HTTP API)
  - change the build, packaging, or publishing pipeline
  - add or replace a major dependency or framework
- Keep it accurate rather than long. Delete text that no longer matches the code.

## 3a. Decision log

- `docs/adr/` holds one file per decision; `docs/adr/README.md` indexes them by status and tag. Check the index before proposing changes that touch provider integration, data handling, security, UI surfaces, or major dependencies.
- Add an ADR when you make or recommend a decision that is hard to reverse, crosses modules, adds or replaces a major dependency or AI provider, changes what code leaves the machine, or resolves an open item. Add its index row in the same change.
- Never rewrite an Accepted ADR's decision. Add a new ADR and mark the old one `Superseded by ADR-NNNN`, in its file and in the index.

## 3b. Keeping docs scalable

- Keep each doc file under about 300 lines. Past that, split it and update the index.
- Every index row must match its file.
- New sections get the next number; never renumber existing ones.

## 4. Security validation (every change)

Read `SECURITY.md` and work through its pre-merge checklist. Minimum:

### Dependencies
- pnpm is the only package manager. Do not add npm or yarn lockfiles.
- Run `pnpm audit --audit-level=high` and `pnpm outdated`. Fix or flag every high or critical advisory.
- Do not add a dependency without checking it is maintained, widely used, correctly spelled, and license compatible. The extension bundle ships to users; every runtime dependency is attack surface.

### Secrets
- Never write API keys, tokens, or credentials into source, tests, fixtures, docs, or commit messages.
- User API keys live only in VS Code `SecretStorage`. Never in settings, workspace state, logs, or webview state.
- Run `gitleaks detect --no-banner` before finishing.
- If you find an exposed secret, tell the user it must be rotated.

### Code
- Webviews: strict Content Security Policy with a per-load nonce, no inline scripts, no remote resources. Render model output as sanitized Markdown only.
- Never build shell commands by string concatenation. Spawn provider CLIs with an argument array and `shell: false`, and pass user code through stdin, not arguments.
- Treat all model output and all user code as untrusted data. Never execute it, never `eval` it, never let it choose commands or file paths.
- Never log user code, prompts, model responses, or API keys outside the opt-in debug channel defined in arch §8.

## 5. Definition of done

A task is complete only when:
1. `docs/spec/` reflects the change.
2. `docs/architecture/` is updated if the change was major; doc indexes match their files.
3. The slice file in `docs/plan/` is updated.
4. Dependency audit has been run; high or critical issues are fixed or flagged.
5. No credentials are in source, and the secret scan is clean.
6. Typecheck, lint, unit tests, and extension integration tests pass, and the extension packages with `vsce package`.

Summarize the results of steps 4 to 6 in your final message.
