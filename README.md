# Recipe Timer

Paste a recipe, URL, or photo — Claude parses it into timed steps that auto-advance while you cook.

**[Live](https://teamytastic.github.io/recipe-timer/)**

```bash
open index.html
# Requires a Claude API key from console.anthropic.com/settings/keys
```

Paste a URL → hit **Generate Timer** → hit **Start** → steps count down and beep on each transition.

---

## Input Anything

Three ways to give it a recipe:

```
Paste text      → "chicken stir fry with broccoli, 20 min"
Paste a URL     → https://www.bbcgoodfood.com/recipes/...
Photo           → photograph a cookbook page (Claude Vision)
```

Claude extracts ingredients and breaks the recipe into atomic steps with accurate durations.

## Timer

Steps auto-advance. Skip forward or backward manually. Audio beep fires on every transition so you don't have to watch the screen. Screen wake lock keeps the display on during active cooking.

## Resume on Refresh

Close the tab mid-cook and reopen it — the app asks to resume from where you left off.

## Recipe Library

Recipes save to a GitHub Gist. Edit from any device via the GitHub web UI. Import/export as JSON for backup.

## Model Choice

Select model per run: Sonnet 4.6 (fast, good for standard recipes) or Opus 4.6 (complex multi-stage recipes).

## GuideFlow

`guideflow.html` is an alternate interface using the same recipe data. Visual step cards instead of a countdown timer. Still experimental.

---

## API Key

Your Claude API key stays in this browser's LocalStorage only. Nothing is sent to any server other than Anthropic's API directly.

## Stack

Single `index.html` — ~2,800 lines, zero npm, no bundler, no build step. CI runs HTML validation and a Claude code review.

**Known quirk:** Chrome mobile sometimes silences the first audio beep. See `docs/solutions/runtime-errors/chrome-mobile-web-speech-silent.md`.

MIT
