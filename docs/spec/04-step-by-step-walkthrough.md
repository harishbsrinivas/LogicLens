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
  - dims lines outside the range a little (configurable with `clarity.focusDimming`, default on),
  - shows the step number in the gutter on the first line.
- **Escape** in the editor clears the focus highlight but keeps the walkthrough.
- Moving the cursor into a step's range highlights that step in the panel (follow mode), without scrolling the editor.

## Depth and audience

Two settings shape the walkthrough; both can be changed from the panel header for the current walkthrough.

- **Depth:** `overview` (3 to 5 steps, big picture), `standard` (default), `detailed` (line-by-line for dense code).
- **Audience:** `newcomer` (names concepts, avoids jargon), `practitioner` (default), `expert` (terse, focuses on intent, invariants, edge cases).

Changing either regenerates the walkthrough after confirmation; the previous one stays until the new overview arrives.

## Explanation language

Explanations are written in `clarity.explanationLanguage`, default `auto`, which follows VS Code's display language. Code identifiers are never translated.

## Streaming behavior

- The overview appears first. Steps appear one at a time as the model produces them.
- A step is shown only once its title and line range are known; its explanation text streams in place.
- If the stream fails partway, finished steps stay, the panel shows what failed, and **Continue** asks for the remaining steps.

## When anchoring fails

If the model returns a line range outside the target or no range at all, the step is still shown, marked "not linked to lines", and highlighting is skipped for it. If more than half the steps fail to anchor, the walkthrough is shown as plain Markdown with a notice (spec §10).
