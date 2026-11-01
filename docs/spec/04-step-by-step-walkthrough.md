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
- Each **step** has a title row and an explanation block just above its first line, at the beginning of the code it explains (ADR-0029). The title row shows "2 · Build the auth URL  L16–31" with Previous and Next. Only the focused step's block is expanded; the others are collapsed to their title row. A step that starts at line 1 has its block below line 1.
- Steps that are not linked to lines (see below) are listed in the overview block with their explanation.

## Navigation

- Click a step's title row to focus it.
- **Next / Previous step** commands with default keys (spec §9) move through the steps that are linked to lines, in walkthrough order. With no step focused, Next starts at the first step and Previous at the last.
- Focusing a step:
  - expands its explanation block and collapses the previously opened one,
  - moves the cursor to the start of the step's first line,
  - scrolls the editor so the range is visible, centered if it fits,
  - highlights the range with a subtle background and a left border in the theme's accent color,
  - dims lines outside the range a little (configurable with `logiclens.focusDimming`, default on),
  - shows the step number in the gutter on the first line,
  - shows "Step 2 of 6, Build the auth URL, lines 16 to 31" in the status bar for screen readers.
- **Escape** in the editor clears the focus highlight but keeps the walkthrough and any open block.
- **Show all steps** (overview block title, palette) expands every step block for skimming; running it again collapses them.
- While a step is focused, moving the cursor into another step's range moves the highlight there (follow mode, `logiclens.followCursor`, default on) without scrolling or opening its block. After Escape, follow mode waits for the next explicit focus.
- Editing the document marks the walkthrough stale ("file changed since" in the overview title). Steps keep their original lines until range tracking arrives (S8).

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
- Until the first tag arrives, the raw text streams into the overview block so the user sees progress.
- If the stream ends without `@@end` or fails partway, finished steps stay, the overview block says so, and **Continue** in its title asks the model for the remaining steps. Continue is not offered once the file has changed.

## When anchoring fails

If the model returns a line range outside the target or no range at all, the step is still shown, marked "not linked to lines", and highlighting is skipped for it. If more than half the steps fail to anchor, the walkthrough is shown as plain Markdown with a notice (spec §10).
