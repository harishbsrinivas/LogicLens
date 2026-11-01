# 4. Step-by-Step Walkthrough

The walkthrough is the core of the product: a guided reading of the target in the order a person should understand it.

## Structure

A walkthrough has:

- **Overview** (1 short paragraph): what this code is for and where it fits.
- **Steps** (typically 3 to 15): each has
  - a **title** of a few words ("Parse the config file"),
  - a **line range** within the target, one or more ranges if the step spans non-adjacent lines,
  - an **explanation** in Markdown, a few sentences, naming inputs, outputs, side effects, and anything surprising,
  - optional **concepts**: short tags for language or framework ideas used ("async iterator", "dependency injection"), shown as tags at the end of the step's explanation. Choosing a tag opens a question thread pre-filled with "Explain <concept> as used here" (S4).
- **Summary**: 2 to 5 takeaways, plus "things to watch" (edge cases, risks, TODOs the model noticed).

## Step order

Steps follow **reading order for understanding**, not necessarily top-to-bottom. A file with helpers at the top and a `main` at the bottom may start at `main`. Each step shows its line numbers, so jumping around stays clear. Step ranges may not overlap except where a step deliberately zooms into part of an earlier one; the model is told to avoid overlap.

## Where it appears

Everything is inline in the editor (spec §7, ADR-0028):

- The **overview** is an explanation block anchored at the top of the file. When the walkthrough finishes, the **summary** and things to watch are added to the same block.
- Each **step** has a title row above its first line ("2 · Build the auth URL", with Previous and Next) and an explanation block under that line. Only the focused step's block is expanded; the others are collapsed to their title row.

## Navigation

- Click a step's title row to focus it.
- **Next / Previous step** commands with default keys (spec §9) work while the editor has focus.
- Focusing a step:
  - expands its explanation block and collapses the previously focused one,
  - scrolls the editor so the range is visible, centered if it fits,
  - highlights the range with a subtle background and a left border in the theme's accent color,
  - dims lines outside the range a little (configurable with `logiclens.focusDimming`, default on),
  - shows the step number in the gutter on the first line.
- **Escape** in the editor clears the focus highlight but keeps the walkthrough.
- Moving the cursor into a step's range marks that step as focused (follow mode) without scrolling the editor or expanding its block.

## Depth and audience

Three settings shape the walkthrough; all can be changed for the current walkthrough from the explanation's title actions or the palette.

- **Depth:** `overview` (3 to 5 steps, big picture), `standard` (default), `detailed` (line-by-line for dense code).
- **Audience** (technical level):
  - `eli5` ("Explain like I'm five"): everyday words, short sentences, one concrete analogy per step ("a cache is like keeping your keys by the door"). No jargon at all. Still accurate and still tied to line ranges; the analogy never replaces what the code actually does.
  - `newcomer`: names concepts and explains each one the first time it appears.
  - `practitioner` (default): assumes working knowledge of the language; explains framework and project specifics.
  - `expert`: terse, focuses on intent, invariants, edge cases, and performance.
- **Jargon:** how technical terms are handled, independent of audience when the user wants it to be.
  - `auto` (default): follows the audience (`eli5` avoid, `newcomer` define, `practitioner` and `expert` use).
  - `avoid`: describes the idea in plain words instead of naming the term.
  - `define`: uses the term and adds a short inline definition the first time it appears in a walkthrough.
  - `use`: uses terms freely without definitions.

Changing any of these regenerates the walkthrough after confirmation; the previous one stays until the new overview arrives. Thread answers (spec §5) follow the same audience and jargon settings.

The voice of the explanation (neutral or a personality pack) is a separate setting; see spec §15.

## Explanation language

Explanations are written in `logiclens.explanationLanguage`, default `auto`, which follows VS Code's display language. Code identifiers are never translated.

## Streaming behavior

- The overview appears first. Steps appear one at a time as the model produces them.
- A step is shown only once its title and line range are known; its explanation text streams in place.
- If the stream fails partway, finished steps stay, the overview block shows what failed, and **Continue** asks for the remaining steps.

## When anchoring fails

If the model returns a line range outside the target or no range at all, the step is still shown, marked "not linked to lines", and highlighting is skipped for it. If more than half the steps fail to anchor, the walkthrough is shown as plain Markdown with a notice (spec §10).
