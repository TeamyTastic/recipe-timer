# Chrome Mobile Web Speech API Silent Failure

---
category: runtime-errors
component: voice/tts
symptoms:
  - Web Speech API calls complete without error but produce no audio
  - speechSynthesis.speaking returns false immediately after speak()
  - Works on desktop but fails on mobile Chrome
platform: Chrome mobile (Android, iOS)
date_solved: 2026-01-05
---

## Problem

Web Speech API (`speechSynthesis.speak()`) fails silently on Chrome mobile. No errors thrown, but no audio produced. The utterance never reaches `onstart` event.

## Root Cause

Chrome mobile has multiple quirks with the Web Speech API:

1. **Stuck queue**: Previous utterances may block the queue
2. **Paused state**: Speech engine randomly enters paused state
3. **15-second timeout**: Chrome kills long utterances after ~15 seconds
4. **Async voice loading**: `getVoices()` returns empty array until `onvoiceschanged` fires

## Solution

Apply three workarounds before each speak call:

```javascript
function speakWebSpeech(text) {
  // Chrome workaround 1: Clear the queue
  window.speechSynthesis.cancel();

  // Wait for voices to load (Chrome loads async)
  let voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      doSpeak();
    };
    return;
  }

  function doSpeak() {
    // Create fresh utterance each time (don't reuse)
    const utterance = new SpeechSynthesisUtterance(text);

    // Set voice, rate, etc.
    utterance.voice = voices.find(v => v.lang === 'en-GB') || voices[0];
    utterance.rate = 1.1;

    // Chrome workaround 2: Cancel, speak, then check paused state
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    // Force resume if stuck in paused state
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Chrome workaround 3: Keep-alive ping every 10s
    const keepAlive = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(keepAlive);
      } else {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  doSpeak();
}
```

## Key Points

1. **Always cancel before speak** - Clears any stuck queue
2. **Create fresh utterance each time** - Don't reuse SpeechSynthesisUtterance objects
3. **Check paused state** - Chrome randomly pauses; force resume
4. **Keep-alive for long text** - Ping every 10s to prevent 15s timeout
5. **Wait for voices** - Use `onvoiceschanged` event, don't assume voices are loaded

## Cross-Browser Voice Selection

Different browsers expose different voice names:

| Platform | British Voice Name |
|----------|-------------------|
| macOS/iOS Safari | `Daniel` (en-GB) |
| Chrome/Android | `Google UK English Male` or `Google UK English Female` |

Use a fallback chain:

```javascript
const britishVoice =
  voices.find(v => v.name.includes('Daniel') && v.lang === 'en-GB') ||
  voices.find(v => v.name.includes('Google UK English Male')) ||
  voices.find(v => v.name.includes('Google UK English')) ||
  voices.find(v => v.lang === 'en-GB') ||
  voices.find(v => v.lang.startsWith('en'));
```

## Prevention

- Always test Web Speech on actual mobile devices (not just desktop Chrome DevTools mobile mode)
- Add debug logging to track which events fire (onstart, onend, onerror)
- Have a TTS fallback (OpenAI TTS, native app, etc.) for critical audio

## Related

- [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Chrome Bug Tracker - Speech Synthesis issues](https://bugs.chromium.org/p/chromium/issues/list?q=component:Blink%3ESpeechSynthesis)
