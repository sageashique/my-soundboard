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

## Numpad Grid — HARD RULES — DO NOT CHANGE

- `grid-template-columns` must always be `repeat(4, minmax(0, 1fr))`
- `pad-0`: `grid-column: 1 / span 2`, `grid-row: 4` (double width)
- `pad-enter`: `grid-column: 4`, `grid-row: 3 / span 2` (double height)
- `pad-stop`: `grid-column: 1 / span 4`, `grid-row: 5` (full width)
- All pads must have: `overflow: hidden`, `min-height: 0`, `min-width: 0`
- Text must never affect pad sizing — label always ellipsis, never wraps
- Never use `aspect-ratio` on `.numpad` or any `.pad`
- Never use `--cell` variable for sizing
- Never use `align-self: stretch` on `.numpad` — use `width: 100%` + `max-width` instead
- Never revert `overflow-x: hidden` on `.sb-page` or `html/body`
- `onTouchStart={() => {}}` must remain on the `.numpad` div (required for iOS `:active`)

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
.pad-enter { grid-column: 4;          grid-row: 3 / span 2; }
.pad-0     { grid-column: 1 / span 2; grid-row: 4; }
.pad-dot   { grid-column: 3;          grid-row: 4; }
.pad-stop  { grid-column: 1 / span 4; grid-row: 5; }
```

---

## Responsive Breakpoints — HARD RULES — DO NOT CHANGE

- **Desktop default (1025px+):** numpad `max-width: 420px`, rows `96px` fixed
- **Tablet landscape (769–1024px):** `max-width: 460px`, rows `100px` fixed
- **Tablet portrait (600–768px):** `max-width: 100%`, rows `calc((100vw - 64px) / 4)`
- **Mobile landscape (`height < 500px`):** `max-width: 340px`, rows `54px` fixed
- **Mobile portrait (≤ 599px):** `max-width: 100%`, rows `calc((100dvw - 32px) / 4)`
- **Small mobile (≤ 390px):** rows `calc((100dvw - 26px) / 4)`
- All page content containers (`.top`, `.status-bar`, `.controls-bar`, `.divider`, `.reset-all-section`) must match numpad `max-width` at every breakpoint
- Mobile landscape must always be handled via `orientation: landscape` + `max-height: 500px`
- Never collapse all mobile sizes into a single breakpoint

## Before Every Commit

- Verify layout renders correctly at: 375px, 430px, 768px portrait, 1024px landscape, 1440px
- If any pad overflows its cell, stop and fix before committing
- Do not touch `.tsx` files for layout issues — CSS only

---

## Audio System

### AudioContext

- Created lazily on first user interaction (`getAC()`).
- A single `masterRef` (`GainNode`) sits between all sources and `ctx.destination`. Volume is applied here.
- On mobile, the context may start `suspended` — `getAC()` resumes it.

### Playing sounds

Two paths through `fire(index)`:

1. **`customRawBuf`** — raw `ArrayBuffer` downloaded from Supabase Storage. Always played via `HTMLAudioElement` (every tap, not just the first). `htmlAudio.volume` is set at play time so the master volume slider applies. This path is used for ALL custom audio (MP3, WAV, M4A) on all platforms.
2. **Built-in sounds** — synthesized via `playSound()` in `src/lib/sounds.ts`. Uses oscillators and buffer sources routed through the Web Audio master gain node.

> **⚠️ DO NOT change custom audio playback to use Web Audio API — this will break mobile.**
>
> This was fully debugged and the HTMLAudioElement approach is the intentional, permanent solution. Here is the complete history so it is never re-introduced:
>
> - **What was tried and failed:** `decodeAudioData().then(s => s.start())` — fails silently on iOS Safari. The AudioContext re-suspends between user interactions. `s.start()` on a suspended context produces no audio and no error.
> - **What was tried and failed:** Adding `await a.resume()` before `s.start()` inside the `.then()` callback — does not work. `AudioContext.resume()` has no effect when called outside a direct user gesture stack (i.e. inside a Promise callback).
> - **What was tried and failed:** Using `decodeAudioData` on first tap, caching `customBuf`, then using Web Audio on subsequent taps — the second tap was also silent for the same reason (AudioContext had re-suspended).
> - **What works:** `HTMLAudioElement.play()` called **synchronously** within the click handler. iOS allows this on every tap. Volume is applied via `htmlAudio.volume` at play time.
>
> **Rules that must not change:**
> 1. Custom audio (`customRawBuf`) must always play via `HTMLAudioElement`, on every tap, not just the first.
> 2. `HTMLAudioElement.play()` must be called synchronously in the `fire()` body — not inside `.then()`, `.catch()`, or any async callback.
> 3. Do not add back a `customBuf` Web Audio playback path, even as an "optimisation for desktop" or "fast path for repeat taps".
> 4. Do not use `createMediaElementSource` — it requires routing through the Web Audio graph and fails on iOS in async contexts.
> 5. The `customBuf` field in `PadState` is vestigial and unused for playback. Do not wire it back into `fire()`.

### Overlap mode

- **Off (default):** Before playing, **both** `activeSourcesRef` (Web Audio nodes) **and** `activeHtmlAudiosRef` (HTMLAudioElement fallbacks) are stopped and cleared. This also applies inside the async `.then()` and `.catch()` callbacks of the lazy-decode path, because other sounds may have started during the async gap.
- **On:** New sounds layer on top without stopping existing ones.
- Overlap must behave identically regardless of the underlying file type. Mixing file types (e.g. firing an M4A pad then an MP3 pad with overlap OFF) must still cut the M4A correctly.

### Stop All

- Cancels master gain, ramps gain to 0 instantly, restores after 80ms.
- Calls `.stop()` on every node in `activeSourcesRef` **and** `.pause()` on every element in `activeHtmlAudiosRef`, then clears both sets.
- Triggered by the Stop bar click or `Space` key.

### Node tracking — two separate sets

`activeSourcesRef` (`Set<AudioBufferSourceNode | OscillatorNode>`) — Web Audio nodes from built-in synthesized sounds.

`activeHtmlAudiosRef` (`Set<HTMLAudioElement>`) — instances used for all custom audio (MP3, WAV, M4A). These cannot go into `activeSourcesRef` because they are not Web Audio nodes.

**Every stop-all and overlap-OFF operation must touch both sets.** Touching only `activeSourcesRef` will leave custom audio playing, causing incorrect overlap behaviour when mixing custom pads with built-in pads.

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

Click **Edit Pads** in the controls bar. The button turns indigo and pads show a dashed ring as a visual signal. All keyboard keys now select pads instead of firing them. Click **Exit Edit Mode** (red button in status bar) or **Edit Pads** again to exit.

### Edit panel fields

| Field | Options |
|---|---|
| Source | Built-in (14 synthesized sounds) or Custom (uploaded audio file) |
| Sound | Dropdown of 14 built-in sounds (built-in mode only) |
| Audio | Drag-and-drop or click-to-browse file upload (custom mode only) |
| Emoji | Emoji picker via `@emoji-mart/react` (always available) |
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

### Page layout (user mode)

Top-to-bottom order, must not change:
1. Header — wordmark row + bold divider + board-switcher/help row
2. Pad grid (numpad)
3. Status bar
4. Thin divider line
5. Controls row — `✏️ Edit Pads` (left) + `⚙️ Settings` (right)
6. Sign-out section (border-top on `.reset-all-section`, no standalone `.divider` div)
7. Footer

### Board name (user mode)

- Displayed as the wordmark in the top-left.
- Click to enter inline edit mode (input + Save / Cancel).
- Default: `{EMAIL_PREFIX}'S SOUNDBOARD` (uppercased).
- Max 30 characters.
- Saved to `user_settings` on Save.

### Settings popover

Both user and demo modes expose a single **⚙️ Settings** button in the controls row (bottom-right). Clicking it opens a popover that opens **upward** (`.settings-popover--up { bottom: calc(100% + 8px) }`). Closes on outside click via `mousedown` listener.

Contents (in order):
1. **Volume** slider (0–1, step 0.05) — desktop only, hidden on iOS (`isIOS` state). Applied to `masterRef.gain.value` (user) or `gainRef.current` (demo).
2. **Sound Overlap** toggle — off by default. When off, firing stops all current audio first. When on, sounds stack.
3. **Dark mode** toggle — `data-theme="dark"` on `<html>`. User mode saves to `user_settings`. Demo is session-only.

### Theme

- Light and dark modes via `data-theme="dark"` on `<html>`.
- Toggle inside ⚙️ Settings popover. User mode saves preference to `user_settings`. Demo is session-only.
- Dark mode uses solid filled pad colors (not the light mode tint+border style).
- In dark mode, `.pad.sel` uses `box-shadow: inset 0 0 0 2px rgba(255,255,255,0.75)` for the selection indicator — **no `border-color` override**, so the pad's color border still shows through.

### Status bar

A pill below the pad grid showing the current state:
- **Idle:** "Ready" (neutral style)
- **Active:** Pad name + emoji (green tint)
- **Stopped:** "⏹ Stopped" (red tint)
- **Edit mode:** Full-width red 'Exit Edit Mode' button replaces the status pill while edit mode is active.

### Volume

Master volume slider inside ⚙️ Settings popover (0–1, step 0.05). Applied directly to `masterRef.gain.value`.

### Sound overlap toggle

Inside ⚙️ Settings popover. Off by default. When off, firing a new pad stops all currently playing sounds first. When on, sounds stack freely.

### Help overlay

Triggered by the **Help** button in the header row. Full-screen overlay with usage instructions. Locks body scroll while open.

### Sign out

Inline confirm flow in `.reset-all-section` (has `border-top`, `margin-top: 12px`, `padding-top: 12px` — no standalone `.divider` div). Calls `supabase.auth.signOut()`.

---

## Demo Mode

Route: `/demo` — served by `src/app/demo/page.tsx` → `src/components/DemoSoundboard.tsx`.

Demo mode is a fully self-contained, unauthenticated soundboard experience. **No Supabase calls.** All state is session-only.

### Demo page layout

Identical to user mode layout order, plus:
- Loading screen (1s delay) with `[sage]SOUNDS` brand + "🎛️ Demo Mode" pill + spinner
- **Demo CTA banner** between controls row and footer — `margin-top: 12px` from controls

### Demo boards

Two fixed boards (no create/rename/delete):

**Demo Board 1** — 14 custom audio clips from `public/demo-clips/`. Played via `HTMLAudioElement` (same iOS-safe pattern as user mode custom audio). Clips preloaded on mount into `clipAudiosRef`.

**Demo Board 2** — 14 synthesized sounds via Web Audio API (same `playSound()` as user mode built-in sounds).

### Demo edit mode

- Pads can be customized (label, emoji, color). Board 2 also allows built-in sound selection.
- **No audio upload** — demo mode only.
- Changes are session-only.
- Edit panel shows a "🎛️ Demo Mode" note with Sign up CTA.

### Demo settings

Same ⚙️ Settings popover as user mode: Volume (desktop), Sound Overlap, Dark mode. All session-only.

---

## Auth Page

Route: `/auth` — served by `src/app/auth/page.tsx`.

Split-panel layout, always dark — independent of the app's light/dark theme toggle.

- **Left panel** (`460px`, dark gradient `#131c33 → #0d1526`): brand mark, hero headline, scrolling marquee pills, 14-pad mini-grid preview, demo CTA link
- **Right panel** (flex: 1, `#0f172a`): sign-in/sign-up tabs, email/password form, OR divider, demo button, footer links

### Auth page conventions

- `[sage]SOUNDS` brand mark: `font-size: 17px; font-weight: 800; letter-spacing: 0.06em` — matches main app header tracking
- `auth-tap-badge`: `<kbd>` style for "tap" in headline — indigo border + background, `#a5b4fc` text
- Marquee pills: `.auth-split-pills` container with `mask-image` edge fade; `.auth-split-pills-track` animates via `@keyframes auth-marquee 28s`. Pause on hover. 6 pills duplicated for seamless loop.
- Mini-pad grid: `grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 62px) 24px`. Pad-0 uses `.auth-mini-0 { grid-column: span 2 }`, pad-enter uses `.auth-mini-enter { grid-row: span 2 }`. Stop bar spans all 4 columns.
- Demo CTA (`.auth-split-demo-cta`): pill-shaped on mobile (`border-radius: 50px`, full-width) to distinguish it from the rectangular pad grid above it.

### Mobile behavior (`max-width: 768px`)

Panels stack vertically. Left panel shows full hero content; right panel shows form below.

- Row heights use `13vw` (scales proportionally with screen width — ~49px at 375px, ~62px at 480px). Stop bar stays fixed at `28px`.
- At `max-width: 480px`: emoji size reduces, border-radius tightens, second sub-copy sentence hidden (`.auth-sub-extra { display: none }`).
- **`.auth-mobile-signin`** — mobile-only "Sign in →" pill button in the brand row (`margin-left: auto` pushes it right). On click, smooth-scrolls to the right panel via `useRef`. Hidden at `min-width: 769px`.

---

## CSS Architecture

- All styles live in `src/app/globals.css`. No component-level CSS files.
- CSS custom properties (`--bg`, `--surface`, `--surface2`, `--border`, `--border2`, `--text`, `--text2`, `--text3`, `--red`, `--green`, `--blue`, `--yellow`, `--purple`, `--pink`, `--gap`, `--pad-radius`) defined on `:root`.
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
| `src/app/auth/page.tsx` | Auth page — split-panel sign in/sign up |
| `src/app/demo/page.tsx` | Demo route — renders `DemoSoundboard` |
| `src/app/about/page.tsx` | About/portfolio page |
| `src/components/Soundboard.tsx` | User mode — all logic, Supabase persistence |
| `src/components/DemoSoundboard.tsx` | Demo mode — self-contained, no Supabase |
| `src/components/Pad.tsx` | Individual pad component |
| `src/components/Modal.tsx` | Confirmation modal |
| `src/lib/sounds.ts` | Built-in sound synthesis |
| `src/lib/constants.ts` | Pad definitions, key mappings, default state |
| `src/lib/types.ts` | TypeScript types (`PadState`, `ModalState`) |
| `src/lib/supabase.ts` | Supabase client |
| `docs/DEMO_vs_USER.md` | Feature matrix: what differs between demo and user mode |

---

## Things That Must Never Change Without Review

1. **Pad grid placement CSS** — any change breaks the numpad layout. See "Numpad Grid — HARD RULES" section above.
2. **`.sb-page` `overflow-x: hidden`** — must not use `clip` (breaks iOS Safari clipping).
3. **`onTouchStart={() => {}}` on `.numpad`** — required for iOS `:active` states to fire.
4. **Custom audio always plays via `HTMLAudioElement`** — do not move to Web Audio API. See "Why HTMLAudioElement for custom audio" note in the Audio System section for the full history of what was tried and why it fails on iOS Safari.
5. **`activeSourcesRef` + `activeHtmlAudiosRef` tracking** — both sets must be consulted for every stop-all and overlap-OFF operation. `activeSourcesRef` holds Web Audio nodes (built-in sounds only); `activeHtmlAudiosRef` holds all custom audio HTMLAudioElement instances. Touching only one set breaks overlap and stop-all.
6. **`detectAudioMime()`** — used to determine the correct MIME type when creating Blob URLs for HTMLAudioElement playback. Required for correct playback of M4A files.
7. **Upsert pattern on `pad_configs` and `user_settings`** — always upsert, never plain insert.
8. **`customRawBuf: null` on reset/save** — must be cleared whenever switching away from custom audio, or the old audio continues to play.
