# 15. Personality Packs

A personality pack changes the **voice** of explanations without changing what they say. It is for people who learn better, or simply enjoy reading more, when the explainer has a character. Delivered after the MVP release (plan S12).

## The packs

| ID | Name | Voice |
|---|---|---|
| `none` | Neutral (default) | Plain, calm, professional. The voice used everywhere else in this spec. |
| `patient-teacher` | Patient Teacher | Warm and encouraging. Builds up step by step, checks understanding ("So far: we have a list of users"), never makes the reader feel slow. |
| `skater` | Skater Dude | Laid-back and upbeat. Casual slang and board metaphors ("this loop just keeps carving through the array"), stoked about clean code, chill about messy code. |
| `sarcastic` | Sarcastic Senior | Dry, deadpan wit aimed at the code, never at the reader. Raises an eyebrow at clever hacks and magic numbers, then explains them properly. |
| `noir-detective` | Noir Detective | 1940s hard-boiled narration. The bug is the suspect, the call stack is the alibi, the data leaves a trail of clues. |
| `sports-commentator` | Sports Commentator | Live play-by-play. The request comes down the field, the validator makes the save, the handler takes it home. |

Five packs plus Neutral. Packs ship with LogicLens; users cannot write their own in this release (custom packs are a post-MVP candidate, spec §11).

## Rules every pack follows

- **Tone only.** The walkthrough structure, step order, line ranges, facts, and "things to watch" are the same as with `none`. A personality never adds, drops, or softens a claim about behavior.
- **Accuracy first.** If a joke or metaphor would blur a technical point, the pack drops it and says the point plainly.
- **Respect.** No profanity, slurs, insults about people or groups, or mockery of the reader or the code's authors. Sarcasm targets the code's choices, lightly.
- **Brevity.** Flavor fits inside the normal length for the depth (spec §4); it does not pad steps.
- **Works with audience and jargon.** `eli5` with Skater Dude is still simple language; `expert` with Patient Teacher is still terse. Audience and jargon rules win over the pack where they conflict.
- **Works with explanation language.** The pack adapts to `logiclens.explanationLanguage`; idioms are localized, not translated word for word.
- **Model text only.** LogicLens's own UI copy, errors, notices, the data notice, and secret-scan messages are never styled by a pack.

## Choosing a pack

- Setting `logiclens.personality` (application scope: a repository cannot pick a voice for the user), default `none`.
- **LogicLens: Set Personality** and a chip in the panel header open a quick pick. Each pack shows its name, a one-line description, and a sample sentence explaining the same line of code, so users can compare before choosing.
- Changing the pack applies to the next request. For the current walkthrough the panel offers **Regenerate in this voice**, which needs confirmation like depth and audience changes (spec §4). Existing threads keep the voice they were written in.
- The footer shows the pack's name next to the model, so a reader knows why the tone is unusual.

## Quality

Each pack is evaluated against `none` on the evaluation set (spec §10): parse and anchor rates within 2 percentage points, and a human review of 10 files per pack with correctness ≥ 4.0 and a tone rubric (on-voice, respectful, not padded). A pack that fails is not shipped.
