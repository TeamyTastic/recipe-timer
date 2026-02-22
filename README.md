# Recipe Timer

A voice-enabled cooking timer that turns recipes into step-by-step countdowns. Paste a recipe, get timed steps with audio announcements. Zero dependencies, works offline.

**Live**: [teamytastic.github.io/recipe-timer](https://teamytastic.github.io/recipe-timer/)

## What It Does

1. Paste a recipe (or pick from the library)
2. The app parses it into timed cooking steps
3. Hit start — each step counts down with audio beeps and voice announcements
4. Steps auto-advance, or skip manually

## Features

| Feature | How |
|---------|-----|
| **Recipe parsing** | Paste text, get structured timed steps |
| **Countdown timer** | Step-by-step with elapsed time and auto-advance |
| **Voice announcements** | Web Speech API reads steps aloud |
| **Audio alerts** | Beep on step transitions |
| **Recipe library** | Save/load from LocalStorage |
| **Resume support** | Timer state survives page refresh |
| **Screen wake lock** | Screen stays on while cooking |
| **Pre-seeded recipes** | Cod Fajitas, Quick Chicken Stir Fry |

## GuideFlow

A second interface (`guideflow.html`) provides step-by-step visual guides — a different take on the same recipe data, focused on visual clarity over timers.

## Tech Stack

- **Framework**: Vanilla HTML/CSS/JavaScript — zero dependencies, no build step
- **Voice**: Web Speech API (text-to-speech)
- **Storage**: LocalStorage (recipe library + active timer state)
- **Design**: Terracotta/cream/olive palette, Fraunces serif, herb SVG decorations
- **CI**: HTML validation + Claude code review workflows
- **Lines**: 2,655 (single `index.html`)

## Running Locally

```bash
# Just open the file — no server needed
open index.html

# Or serve it
python3 -m http.server 8000
```

## Known Issues

Chrome mobile has a quirk with Web Speech API where the first utterance is silent. Workaround documented in `docs/solutions/runtime-errors/chrome-mobile-web-speech-silent.md`.

## License

MIT
