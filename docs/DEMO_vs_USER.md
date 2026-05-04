# Demo Mode vs User Mode — Feature Reference

Use this doc to understand what belongs in each mode. Do not add user-only features to demo, or demo-only UI to user mode.

---

## Feature Matrix

| Feature | User Mode | Demo Mode |
|---|---|---|
| Auth required | Yes (Supabase email) | No |
| Route | `/` (auth-gated) | `/demo` |
| Component | `Soundboard.tsx` | `DemoSoundboard.tsx` |
| Persistence | Supabase (cloud, cross-device) | Session-only (lost on refresh) |
| Number of boards | Up to 5, user-named | 2 fixed boards |
| Board switcher | Yes — rename, create, delete | Yes — switch only |
| Custom audio upload | Yes (MP3/WAV/M4A, max 10 MB) | No |
| Built-in synth sounds | Yes (14 sounds) | Yes — Board 2 only |
| Demo clips | No | Yes — Board 1 (14 clips from `/demo-clips/`) |
| Edit pad: label / emoji / color | Yes | Yes |
| Edit pad: sound (built-in) | Yes | Yes — Board 2 only |
| Edit pad: audio upload | Yes | No |
| Settings: Volume | Yes (desktop, hidden on iOS) | Yes (desktop, hidden on iOS) |
| Settings: Sound Overlap | Yes | Yes |
| Settings: Dark mode | Yes (saved to Supabase) | Yes (session-only) |
| Reset Pad | Yes | No |
| Reset All Pads | Yes | No |
| Sign out | Yes | No |
| Demo CTA banner | No | Yes (below controls, above footer) |
| Loading screen | No | Yes (1s delay, branded) |
| Help panel | Yes | Yes |
| About page link | Yes (footer) | Yes (footer) |

---

## Audio Architecture

### User Mode

- **Custom audio** → `HTMLAudioElement` (always, every tap). iOS-safe. Stored in `customRawBuf` as `ArrayBuffer`, downloaded from Supabase Storage on load.
- **Built-in sounds** → Web Audio API via `playSound()`. Routed through master `GainNode`.
- Two tracking sets: `activeSourcesRef` (Web Audio nodes) + `activeHtmlAudiosRef` (custom HTMLAudioElements). Both must be stopped on overlap-OFF and stop-all.

### Demo Mode

- **Board 1 clips** → `HTMLAudioElement` (same iOS-safe pattern). Preloaded from `public/demo-clips/` into `clipAudiosRef` (`Map<string, HTMLAudioElement>`). Volume applied via `audio.volume` at play time.
- **Board 2 synth** → Web Audio API via `playSound()`. Routed through demo's own `gainRef`.
- Single tracking set: `activeSrcsRef` (covers both Web Audio nodes). Clip HTMLAudioElements tracked via `clipAudiosRef`.

---

## Settings Popover

Both modes use the same **⚙️ Settings** button pattern (bottom-right of controls row, opens upward). The popover contains the same three settings in the same order. The only behavioral difference is persistence: user mode saves dark mode preference to Supabase; demo mode doesn't save anything.

---

## What "Session-Only" Means in Demo

Changes made in demo mode (pad labels, colors, emoji, dark mode toggle, sound overlap) live in React state. They reset to defaults on page refresh. There is no persistence layer — no Supabase, no localStorage, no cookies.

---

## Controls Row Layout

Both modes share the same bottom controls row structure:

```
[ ✏️ Edit pads ]              [ ⚙️ Settings ]
```

- Left: Edit pads toggle (✏️ Edit pads / ✓ Done)
- Right: Settings popover button
- Both are `.btn .btn-outline` (inactive) or `.btn .btn-edit-active` (active/open)
- Row class: `.controls-bar .controls-bar-split` (margin-bottom: 0)

User mode only: below controls → `.reset-all-section` (border-top, margin-top: 12px, padding-top: 12px) containing email + Sign out.

Demo mode only: below controls → `.demo-cta-banner` (margin-top: 12px) with Demo Mode CTA.

---

## Help Panel Content

Both modes have a Help panel. Key differences:

| Section | User Mode | Demo Mode |
|---|---|---|
| Title | "How to use your Soundboard" | "🎛️ [sage]SOUNDS — Demo" |
| Playing sounds | ✓ | ✓ |
| Stopping sounds | ✓ | ✓ |
| Settings | ✓ (Settings popover) | ✓ (Settings popover) |
| Editing pads | ✓ (includes Custom audio upload) | ✓ (session-only note) |
| Your boards | ✓ (rename, create, delete) | ✓ (two fixed boards) |
| Saving | ✓ | — |
| Want more? (sign up CTA) | — | ✓ |
