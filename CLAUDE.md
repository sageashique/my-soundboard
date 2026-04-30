# CLAUDE.md — Soundboard Reference

> **Always read this file before making any changes to the codebase.**
> It is the single source of truth for how this app works and how it must behave.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Global CSS (`src/app/globals.css`) — no Tailwind, no CSS modules |
| Auth | Supabase Auth (email + password) |
| Database | Supabase PostgreSQL (`pad_configs`, `user_settings` tables) |
| Storage | Supabase Storage (`custom-tracks` bucket) |
| Audio | Web Audio API (`AudioContext`, `GainNode`, `AudioBufferSourceNode`, `OscillatorNode`) |
| Deployment | Vercel |

---

## Pad Grid Layout — Apple Numpad Style

### Critical rules — never break these

The pad grid mirrors an **Apple numeric keypad**. Every pad must be the **same fixed size** (`var(--cell)` × `var(--cell)`) with two exceptions:

| Pad | Key | Rule |
|---|---|---|
| `pad-0` | `0` | **Double width** — spans columns 1–2, row 4 |
| `pad-enter` | `Enter` | **Double height** — spans rows 3–4, column 4 |
| All others | `7 8 9 − 4 5 6 + 1 2 3 .` | Single cell, uniform width and height |

The stop bar (`pad-stop`) spans all 4 columns and sits in row 5 (the 5th grid row).

### Grid definition

```css
.numpad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, var(--cell)) 56px; /* row 5 = stop bar */
  gap: var(--gap);
}
```

### Grid placement — do not change

```css
.pad-7     { grid-column: 1;          grid-row: 1; }
.pad-8     { grid-column: 2;          grid-row: 1; }
.pad-9     { grid-column: 3;          grid-row: 1; }
.pad-minus { grid-column: 4;          grid-row: 1; }
.pad-4     { grid-column: 1;          grid-row: 2; }
.pad-5     { grid-column: 2;          grid-row: 2; }
.pad-6     { grid-column: 3;          grid-row: 2; }
.pad-plus  { grid-column: 4;          grid-row: 2; }
.pad-1     { grid-column: 1;          grid-row: 3; }
.pad-2     { grid-column: 2;          grid-row: 3; }
.pad-3     { grid-column: 3;          grid-row: 3; }
.pad-enter { grid-column: 4;          grid-row: 3 / span 2; } /* double height */
.pad-0     { grid-column: 1 / span 2; grid-row: 4; }          /* double width */
.pad-dot   { grid-column: 3;          grid-row: 4; }
.pad-stop  { grid-column: 1 / span 4; grid-row: 5; }
```

### Pad sizes by breakpoint

| Breakpoint | `--cell` | `--gap` |
|---|---|---|
| Default (desktop) | `140px` | `10px` |
| `≤ 600px` | `92px` | `8px` |
| `≤ 430px` | `76px` | `6px` |
| `≤ 380px` | `68px` | `5px` |

---

## Mobile Layout Rules

### Critical — never regress these

- `.sb-page` must use `overflow-x: hidden` (not `clip`). Using `clip` skips BFC creation and can fail to clip overflowing children on iOS Safari.
- `.numpad` `max-width` must be `600px` — never `min(600px, 100vw)`. The `100vw` form equals the full viewport width (e.g. 390px on iPhone), which is wider than the content area (viewport minus horizontal padding) and causes the 4th column to clip.
- In the `≤ 600px` breakpoint, `.numpad` must use `width: calc(100vw - 24px)` and `max-width: calc(100vw - 24px)`. This bypasses an iOS Safari flexbox quirk where `width: 100%` on a flex child resolves to the outer container width (ignoring padding) instead of the content area. The `24px` = 12px left + 12px right padding on `.sb-page` at that breakpoint. This covers iPhone Plus/Pro Max models (430pt CSS width) which fall in the 430–600px range.
- In the `≤ 430px` breakpoint, `.numpad` must use `width: calc(100vw - 16px)` and `max-width: calc(100vw - 16px)`. The `16px` = 8px left padding + 8px right padding on `.sb-page` at that breakpoint.
- `html, body` must have `overflow-x: hidden` and `max-width: 100vw` to prevent body-level scroll.
- `onTouchStart={() => {}}` must remain on the `.numpad` div. iOS Safari will not fire CSS `:active` on `<div>` elements unless a `touchstart` handler exists on the element or an ancestor.

---

## Audio System

### AudioContext

- Created lazily on first user interaction (`getAC()`).
- A single `masterRef` (`GainNode`) sits between all sources and `ctx.destination`. Volume is applied here.
- On mobile, the context may start `suspended` — `getAC()` resumes it.

### Playing sounds

Three paths through `fire(index)`:

1. **`customBuf`** — pre-decoded `AudioBuffer`. Created via `AudioBufferSourceNode`, connected to master.
2. **`customRawBuf`** — raw `ArrayBuffer` not yet decoded. Decoded lazily on first tap (required for mobile where `decodeAudioData` must run inside a user-gesture). Falls back to `HTMLAudioElement + createMediaElementSource` if `decodeAudioData` fails (e.g. M4A/AAC on Android Chrome).
3. **Built-in sounds** — synthesized via `playSound()` in `src/lib/sounds.ts`. Uses oscillators and buffer sources.

### Overlap mode

- **Off (default):** Before playing, **both** `activeSourcesRef` (Web Audio nodes) **and** `activeHtmlAudiosRef` (HTMLAudioElement fallbacks) are stopped and cleared. This also applies inside the async `.then()` and `.catch()` callbacks of the lazy-decode path, because other sounds may have started during the async gap.
- **On:** New sounds layer on top without stopping existing ones.
- Overlap must behave identically regardless of the underlying file type. Mixing file types (e.g. firing an M4A pad then an MP3 pad with overlap OFF) must still cut the M4A correctly.

### Stop All

- Cancels master gain, ramps gain to 0 instantly, restores after 80ms.
- Calls `.stop()` on every node in `activeSourcesRef` **and** `.pause()` on every element in `activeHtmlAudiosRef`, then clears both sets.
- Triggered by the Stop bar click or `Space` key.

### Node tracking — two separate sets

`activeSourcesRef` (`Set<AudioBufferSourceNode | OscillatorNode>`) — all Web Audio nodes.

`activeHtmlAudiosRef` (`Set<HTMLAudioElement>`) — instances created by the M4A/AAC fallback path. These cannot go into `activeSourcesRef` because they are not Web Audio nodes.

**Every stop-all and overlap-OFF operation must touch both sets.** Touching only `activeSourcesRef` will leave HTMLAudioElement fallback sounds playing, causing incorrect overlap behaviour when mixing M4A pads with MP3/WAV/built-in pads.

The "Ready" status is only set when **both** sets are empty.

All Web Audio nodes — including every node in multi-node sounds (Clap, AirHorn, Laugh, Notif) — are registered in `activeSourcesRef`. The `playSound()` function accepts the set and adds every node it creates via a `reg()` helper. `onended` is attached to every new node using a before/after snapshot of the set.

### MIME detection

`detectAudioMime(buf: ArrayBuffer)` reads magic bytes to determine the true MIME type, used when uploading and when creating `Blob` URLs for the HTMLAudioElement fallback. Upload `contentType` uses this detected type, not the `File.type` property (which can be wrong or missing on mobile).

---

## Built-in Sounds

14 synthesized sounds, one per pad:

| Key | Sound | Description |
|---|---|---|
| 7 | Kick | Sine oscillator, exponential frequency drop |
| 8 | Snare | Highpass-filtered white noise |
| 9 | Hi-Hat | Highpass-filtered white noise, very short |
| − | Clap | 3-layer bandpass noise bursts |
| 4 | Rimshot | Short triangle oscillator |
| 5 | 808 Bass | Sawtooth + lowpass filter, frequency drops |
| 6 | Synth | Square wave at 440Hz |
| + | Riser | Sawtooth, frequency sweeps 80Hz → 2kHz |
| 1 | Scratch | Sinusoidal × random, bandpass filtered |
| 2 | Air Horn | 3-oscillator sawtooth chord |
| 3 | Laugh | 5-burst sine oscillator pattern |
| ↵ | Notif | Two-tone sine ping |
| 0 | Siren | Sawtooth sweeping 600Hz ↔ 1200Hz |
| . | Swoosh | Bandpass-filtered shaped noise |

---

## Keyboard Shortcuts

| Key | Normal mode | Edit mode |
|---|---|---|
| `7 8 9 - 4 5 6 = 1 2 3 Enter 0 .` | Fire pad | Select pad for editing |
| `Space` | Stop all audio | Stop all audio |

- Key repeat is suppressed via `heldRef` (a `Set` tracking currently held keys).
- Keyboard events are ignored when focus is on an `<input>` or `<select>`.

---

## Pad Customization (Edit Mode)

### How to enter edit mode

Click **Edit mode** in the controls bar. All keyboard keys now select pads instead of firing them. Click **Done** to exit.

### Edit panel fields

| Field | Options |
|---|---|
| Source | Built-in (14 synthesized sounds) or Custom (uploaded audio file) |
| Sound | Dropdown of 14 built-in sounds (built-in mode only) |
| Audio | Drag-and-drop or click-to-browse file upload (custom mode only) |
| Emoji | Emoji picker via `@emoji-mart/react` (custom mode only) |
| Label | Text input, max 20 characters |
| Color | 6 swatches: red, green, blue, yellow, purple, pink |

### Color preview

While editing, the selected pad renders with `selColor` (the currently highlighted swatch color) **before** saving — so color changes are visible in real time. This is done by passing `{ ...pad, color: selColor }` to the selected pad's `<Pad>` component while `editing && selPad === i`.

### Saving

- Uploads the audio file to Supabase Storage at `{user_id}/pad-{index}` (upsert).
- Writes/updates the row in `pad_configs` (upsert on `user_id, pad_index`).
- Clears `pendingBuf`, `pendingFileName`, `pendingRawRef`.
- If switching from custom → built-in, deletes the old storage file.

### Reset pad

- Restores default sound, label, icon, color for that index.
- Deletes custom storage file if one exists.
- Updates the `pad_configs` row with defaults.
- Only enabled when the pad has a custom track loaded.

### Reset all

- Confirms via inline confirm UI.
- Stops all audio.
- Deletes all custom storage files for the user.
- Deletes all `pad_configs` rows for the user.
- Resets all pads to defaults in state and exits edit mode.

---

## Persistence (Supabase)

### Tables

**`pad_configs`**

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK to auth.users |
| `pad_index` | int | 0–13 |
| `sound` | text | Built-in sound name |
| `label` | text | Display label |
| `color` | text | One of 6 color names |
| `icon` | text | Emoji character |
| `custom_track_path` | text | Storage path, or null |
| `custom_track_name` | text | Original filename, or null |
| `updated_at` | timestamp | |

Unique constraint: `(user_id, pad_index)`. All writes use `upsert`.

**`user_settings`**

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid | FK to auth.users |
| `board_name` | text | Custom board name |
| `theme` | text | `'light'` or `'dark'` |
| `updated_at` | timestamp | |

Unique constraint: `user_id`. All writes use `upsert`.

### Storage

Bucket: `custom-tracks`  
Path pattern: `{user_id}/pad-{index}`  
Upload: `upsert: true`, correct `contentType` from `detectAudioMime()`.

### Load sequence on mount

1. Load `user_settings` → apply board name and theme.
2. Load all `pad_configs` rows → apply to state.
3. For each pad with a `custom_track_path`, download the audio file and store raw bytes in `customRawBuf` (decoded lazily on first tap).

---

## UI Features

### Board name

- Displayed as the wordmark in the top-left.
- Click to enter inline edit mode (input + Save / Cancel).
- Default: `{EMAIL_PREFIX}'S SOUNDBOARD` (uppercased).
- Max 30 characters.
- Saved to `user_settings` on Save.

### Theme

- Light and dark modes via `data-theme="dark"` on `<html>`.
- Toggle in the controls bar. Preference saved to `user_settings`.
- Dark mode uses solid filled pad colors (not the light mode tint+border style).
- In dark mode, `.pad.sel` uses `box-shadow: inset 0 0 0 2px rgba(255,255,255,0.75)` for the selection indicator — **no `border-color` override**, so the pad's color border still shows through.

### Status bar

A pill below the pad grid showing the current state:
- **Idle:** "Ready" (neutral style)
- **Active:** Pad name + emoji (green tint)
- **Stopped:** "⏹ Stopped" (red tint)

### Volume

Master volume slider (0–1, step 0.05). Applied directly to `masterRef.gain.value`.

### Sound overlap toggle

Off by default. When off, firing a new pad stops all currently playing sounds first. When on, sounds stack freely.

### Help overlay

Triggered by the `?` button in the top-right. Full-screen overlay with usage instructions. Locks body scroll while open.

### Sign out

Inline confirm flow. Calls `supabase.auth.signOut()`.

---

## CSS Architecture

- All styles live in `src/app/globals.css`. No component-level CSS files.
- CSS custom properties (`--bg`, `--surface`, `--surface2`, `--border`, `--border2`, `--text`, `--text2`, `--text3`, `--red`, `--green`, `--blue`, `--yellow`, `--purple`, `--pink`, `--cell`, `--gap`) defined on `:root`.
- Dark theme overrides set under `[data-theme="dark"]`.
- `* { box-sizing: border-box; margin: 0; padding: 0; }` is global.
- Pad color classes: `.c-red`, `.c-green`, `.c-blue`, `.c-yellow`, `.c-purple`, `.c-pink`.
- Pad selection: `.pad.sel` adds a border + inset box-shadow. In dark mode, only box-shadow is used (no border-color override).

---

## Key Files

| File | Purpose |
|---|---|
| `src/app/globals.css` | All styles |
| `src/app/page.tsx` | Root page, auth gate |
| `src/components/Soundboard.tsx` | Main component — all logic |
| `src/components/Pad.tsx` | Individual pad component |
| `src/components/Modal.tsx` | Confirmation modal |
| `src/lib/sounds.ts` | Built-in sound synthesis |
| `src/lib/constants.ts` | Pad definitions, key mappings, default state |
| `src/lib/types.ts` | TypeScript types (`PadState`, `ModalState`) |
| `src/lib/supabase.ts` | Supabase client |

---

## Things That Must Never Change Without Review

1. **Pad grid placement CSS** — any change breaks the numpad layout.
2. **`.numpad` `max-width: 600px`** — must not use `100vw` (causes 4th column clip on iPhone).
3. **`.sb-page` `overflow-x: hidden`** — must not use `clip` (breaks iOS Safari clipping).
4. **`.numpad` explicit width in both mobile breakpoints** — `≤600px` must use `calc(100vw - 24px)` (12px×2 padding); `≤430px` must use `calc(100vw - 16px)` (8px×2 padding). Never use `width: 100%` on mobile — iOS Safari resolves it to the outer container width, clipping the 4th column.
5. **`onTouchStart={() => {}}` on `.numpad`** — required for iOS `:active` states to fire.
6. **`activeSourcesRef` + `activeHtmlAudiosRef` tracking** — both sets must be consulted for every stop-all and overlap-OFF operation. `activeSourcesRef` holds Web Audio nodes; `activeHtmlAudiosRef` holds HTMLAudioElement instances from the M4A/AAC fallback. Touching only one set breaks overlap when mixing file types.
7. **`pendingFileTypeRef` / `detectAudioMime()`** — required for M4A/AAC playback on Android Chrome.
8. **Upsert pattern on `pad_configs` and `user_settings`** — always upsert, never plain insert.
9. **`customRawBuf: null` on reset/save** — must be cleared whenever switching away from custom audio, or the old audio continues to play.
