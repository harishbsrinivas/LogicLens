# 16. Settings Page

A LogicLens settings page gathers every LogicLens setting in one place, grouped by what it affects, with the provider status beside the provider choice. VS Code's own Settings editor and `settings.json` keep working; the page writes the same settings.

## Opening it

- **LogicLens: Open Settings** (palette), the gear in the Bookmarks view title, and **All LogicLens settings…** in the explanation's **Adjust Explanation…** menu.
- It opens as an editor tab titled "LogicLens Settings". Opening it again brings the same tab forward.

## What it shows

Sections, in order, each with a heading and short help under each control:

| Section | Settings | Also |
|---|---|---|
| AI provider | `provider`, `model` (a list of the chosen provider's models, or the first ready provider's for `auto`, with "Provider's default" first) | Each provider's state (Ready, Needs sign-in, Not installed, Unavailable) and reason; **Choose with the picker…** |
| Explanations | `depth`, `audience`, `jargon`, `explanationLanguage` | |
| Privacy and limits | `secrets.action`, `exclude` (one pattern per line), `maxLines` | **Reset data notices**, **View terms of use** |
| Display | `focusDimming`, `followCursor`, `codeLens.enabled` | |
| Saved explanations | `cache.enabled` | **Clear cache** |
| Command-line providers | `cli.claudePath`, `cli.timeoutSeconds` | |
| Troubleshooting | `debug.logPrompts` | **Show log** |

A link list at the top jumps to each section, and **Open settings.json** opens the user settings file.

## Editing

- A change is saved to **user** settings as soon as the control changes. The page never writes workspace or folder settings.
- A setting with a user value shows **Reset**, which removes the user value.
- When a workspace sets a resource-scoped setting (`depth`, `audience`, `jargon`, `maxLines`), the page says so, because the workspace value applies there. For `exclude` it lists the patterns the workspace adds; they can only add, never remove (spec §9).
- A value that is not allowed (a choice not in the list, a number below the minimum, a language that is not a BCP 47 tag, multi-line text) is not saved; the control shows the reason.
- The page updates when settings change elsewhere (Settings editor, `settings.json`, quick picks) and when provider detection changes.

## Privacy and safety

- The page reads and writes settings only. It sends nothing to any AI provider, shows no code and no model output, and has no network access (spec §8, ADR-0031).
- Its buttons run only their named LogicLens commands (and VS Code's Open User Settings JSON).
- It follows the theme (light, dark, high contrast) and is fully usable with the keyboard; every control has a visible label and its help text as its description.
