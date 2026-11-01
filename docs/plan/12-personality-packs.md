# S12. Personality Packs

**Status:** Not started
**User value:** choose the voice of the explainer: Patient Teacher, Skater Dude, Sarcastic Senior, Noir Detective, or Sports Commentator, without losing accuracy.
**Spec:** §15, §4 (interaction with audience and jargon), §9
**Timing:** after S9 (first release). Ships as a minor release, before S7.

## Scope

In:
- Five packs plus `none` as versioned fragments in `src/prompts/personalities/` (ADR-0023).
- `logiclens.personality` setting (application scope), `logiclens.setPersonality` quick pick with description and sample sentence per pack.
- Explanation thread title action; **Regenerate in this voice** with confirmation; thread header line shows pack name.
- Pack ID and version in the cache key and in thread metadata.
- Applies to walkthroughs, refreshes, and thread answers; never to UI copy.

Out: user-defined packs (post-MVP, needs an ADR), per-file or per-workspace voice.

## Tasks

- [ ] Prompt fragments and precedence line in the system prompt; snapshot tests per pack; bump prompt version.
- [ ] Quick pick with samples; thread title action and regenerate flow.
- [ ] Cache key change with a migration that ignores old entries rather than misreading them.
- [ ] Eval: run the corpus for each pack; parse and anchor rates within 2 points of `none`.
- [ ] Human review: 10 files per pack for correctness (≥ 4.0) and the tone rubric (on-voice, respectful, not padded); add rubric to `test/eval/RUBRIC.md`.
- [ ] Red-team fixtures: code with offensive identifiers or comments; check no pack amplifies them.
- [ ] Update arch §5, §7 and `CHANGELOG.md`.

## Demo script

1. Set personality to Skater Dude; explain a file. Same steps and ranges as Neutral, casual voice, footer shows "Skater Dude".
2. Switch to Sarcastic Senior; click **Regenerate in this voice**; confirm.
3. Set audience to `eli5` with Patient Teacher; explanation is simple and encouraging.
4. Trigger an error (stop the provider); the error message is plain, not in voice.
5. Ask a question at a line; answer uses the current pack.

## Exit check

- [ ] Demo script passes.
- [ ] Every shipped pack meets the spec §15 quality gate; failing packs are removed from the enum before release.
- [ ] All tests green.
