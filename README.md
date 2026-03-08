# Recipe Timer

> **When** you're mid-cook with floury hands and a timer going off, **you want** to know exactly what to do next — **so you can** stay in the flow without hunting through a recipe on your phone.

**Live**: [teamytastic.github.io/recipe-timer](https://teamytastic.github.io/recipe-timer/)

---

## The Problem With Recipe Timer Apps

Most timer apps make you do the work: read the recipe, estimate the times, set timers manually. Then you're managing three timers, your phone keeps locking, and you've lost your place.

Recipe Timer does the parsing. Paste text, drop a URL, or photograph a cookbook page — Claude reads it and produces a step-by-step countdown. You just cook.

---

## What Makes It Different

**Input anything.** Text, URL, or photo. Paste a BBC Good Food link, type "chicken stir fry with broccoli", or point your camera at a cookbook. Claude extracts the recipe.

**Steps, not a wall of text.** Claude breaks the recipe into atomic steps — one action each — with accurate durations. Steps auto-advance. The screen stays on (wake lock). If you close the tab mid-cook and come back, it asks to resume.

**Audio alerts.** A beep fires on every step transition so you don't have to watch the screen.

**Gordon Ramsay energy.** The prompt is written to get direct, urgent step instructions — not passive cookbook prose. "SEARING hot pan. Listen for that sizzle." Less narration, more coaching.

**No build step.** Single `index.html`, zero npm, no bundler. Open the file or serve it — same result. CI runs HTML validation and a Claude code review, not a build pipeline.

**Shared recipe library.** Recipes save to a GitHub Gist — editable from any device via the GitHub web UI. LocalStorage caches recent runs. JSON backup/restore for portability.

---

## How It Works

1. Paste a recipe, URL, or photo
2. Choose Claude model (Sonnet 4.6 for speed, Opus 4.6 for complex recipes)
3. Hit **Generate Timer** — Claude parses it into timed steps
4. Hit **Start** — steps count down, beep on each transition, screen stays on
5. Skip steps manually, pause, or let it auto-advance to the end

Your Claude API key stays in this browser only (LocalStorage). No server sees it.

---

## Features

| Feature | Detail |
|---------|--------|
| **Recipe parsing** | Text, URL (with CORS fetch), or photo via Claude Vision |
| **Step countdown** | Elapsed + remaining, auto-advance, manual skip |
| **Audio alerts** | Web Audio API beep on step transitions |
| **Screen wake lock** | Screen stays on during active cooking |
| **Resume on refresh** | Timer state survives tab close/reload |
| **Recipe library** | Gist-backed shared library, editable via GitHub web UI |
| **Recent recipes** | Last few runs cached locally for one-tap reload |
| **Backup / restore** | Export and import library as JSON |
| **GuideFlow** | Second interface (`guideflow.html`) — same recipe data, visual step cards instead of countdown |
| **Model choice** | Sonnet 4.6 (fast) or Opus 4.6 (complex recipes) per run |

---

## Running Locally

```bash
# No server needed — just open the file
open index.html

# Or serve it (useful for camera/photo input on mobile)
python3 -m http.server 8000
```

Requires a Claude API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys). The key is stored in your browser's LocalStorage — nothing is sent to any server other than Anthropic's API.

---

## Current State

Single-file app (~2,800 lines). Works well for weeknight cooking use. Known quirk: Chrome mobile sometimes silences the first audio beep — workaround documented in `docs/solutions/runtime-errors/chrome-mobile-web-speech-silent.md`.

GuideFlow (`guideflow.html`, ~1,500 lines) is a parallel interface — same recipe input, different presentation. Still experimental.

---

## License

MIT
