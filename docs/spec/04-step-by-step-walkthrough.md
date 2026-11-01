# 4. Step-by-Step Walkthrough

The walkthrough is the core of the product: a guided reading of the target in the order a person should understand it.

## Structure

A walkthrough has:

- **Overview** (1 short paragraph): what this code is for and where it fits.
- **Steps** (typically 3 to 15): each has
  - a **title** of a few words ("Parse the config file"),
  - a **line range** within the target, one or more ranges if the step spans non-adjacent lines,
  - an **explanation** in Markdown, a few sentences, naming inputs, outputs, side effects, and anything surprising,
  - optional **concepts**: short tags for language or framework ideas used ("async iterator", "dependency injection"), shown as chips. Clicking a chip opens a question thread pre-filled with "Explain <concept> as used here".
- **Summary**: 2 to 5 takeaways, plus "things to watch" (edge cases, risks, TODOs the model noticed).

## Step order

Steps follow **reading order for understanding**, not necessarily top-to-bottom. A file with helpers at the top and a `main` at the bottom may start at `main`. Each step shows its line numbers, so jumping around stays clear. Step ranges may not overlap except where a step deliberately zooms into part of an earlier one; the model is told to avoid overlap.

## Navigation

- Click a step to focus it.
- **Next / Previous step** commands with default keys (spec §9) work while the editor or the panel has focus.
- Focusing a step:
  - scrolls the editor so the range is visible, centered if it fits,
  - highlights the range with a subtle background and a left border in the theme's accent color,
  - dims lines outside the range a little (configurable with `logiclens.focusDimming`, default on),
  - shows the step number in the gutter on the first line.
- **Escape** in the editor clears the focus highlight but keeps the walkthrough.
- Moving the cursor into a step's range highlights that step in the panel (follow mode), without scrolling the editor.

## Depth and audience

Three settings shape the walkthrough; all can be changed from the panel header for the current walkthrough.

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
- If the stream fails partway, finished steps stay, the panel shows what failed, and **Continue** asks for the remaining steps.

## When anchoring fails

If the model returns a line range outside the target or no range at all, the step is still shown, marked "not linked to lines", and highlighting is skipped for it. If more than half the steps fail to anchor, the walkthrough is shown as plain Markdown with a notice (spec §10).
