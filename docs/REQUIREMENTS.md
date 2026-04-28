# Soundboard — Project Requirements

## Overview
A web-based soundboard application built with Next.js, Supabase, and Vercel. Users log in, configure a 14-pad grid with built-in or custom sounds, and trigger them via tap or keyboard. All configuration and audio persists per user account across devices.

---

## Stack
- **Frontend:** Next.js 15 (App Router, TypeScript, `use client`)
- **Auth & DB:** Supabase (magic link / email auth, PostgreSQL, Storage)
- **Hosting:** Vercel (auto-deploy from GitHub `main` branch)
- **Packages:** `@emoji-mart/react`, `@emoji-mart/data`

---

## Authentication
- Email-based auth via Supabase
- Session checked client-side on mount via `supabase.auth.getSession()`
- `onAuthStateChange` subscription redirects to `/auth` on sign-out
- No middleware — route protection is client-side only
- No server components involved in auth flow

---

## Pad Grid

### Layout
- 14 pads in Apple numpad layout (4 columns × 4 rows + stop bar row 5)
- Grid placement:

| Key | Grid Position |
|-----|--------------|
| 7, 8, 9, − | Row 1, cols 1–4 |
| 4, 5, 6, + | Row 2, cols 1–4 |
| 1, 2, 3 | Row 3, cols 1–3 |
| Enter | Row 3–4, col 4 (double height) |
| 0 | Row 4, cols 1–2 (double wide) |
| . | Row 4, col 3 |
| Stop bar | Row 5, cols 1–4 (full width) |

### Pad Visual Design
- 2px solid colored border (full perimeter)
- Background tint: 4% opacity of border color at rest
- Background tint: 10% opacity on hover
- Smooth `background` transition on hover
- Key label — top left corner
- Custom dot indicator — top right corner (green, shown when custom audio assigned)
- Emoji icon — center
- Text label — bottom, 20 char max, truncated with ellipsis, uppercase

### Colors (6 options)
Red, Green, Blue, Yellow, Purple, Pink

### Stop Bar
- Full-width bar spanning all 4 columns, row 5
- White background at rest, 2px gray border (`--border2`)
- Red tint background (`rgba(217,79,61,0.10)`) on hover, border remains gray
- ⏹ icon and "Stop" label always red
- "Space" key hint shown in muted gray

---

## Audio Engine

### Built-in Sounds (14)
Kick, Snare, Hi-Hat, Clap, Rimshot, 808 Bass, Synth, Riser, Scratch, Air Horn, Laugh, Notif, Siren, Swoosh — all synthesized via Web Audio API

### Playback
- Single `AudioContext` + master `GainNode` created on first user gesture
- All active sources tracked in a `Set` (both `AudioBufferSourceNode` and `OscillatorNode`)
- Status resets to "Ready" when last active source ends naturally

### Stop All
- Master gain ramped to 0 instantly, restored after 80ms
- All tracked sources stopped and cleared
- Works regardless of overlap mode

### Sound Overlap Mode
- Off (default): new pad fire stops current source
- On: sounds layer freely

### Mobile Audio (iOS Safari)
- `AudioContext` only created after user gesture
- Custom audio stored as raw `ArrayBuffer` on load
- Decoded lazily on first tap using existing post-gesture `AudioContext`
- Decoded buffer cached in state for instant subsequent playback
- `ArrayBuffer.slice(0)` used before every `decodeAudioData` call to prevent detached buffer errors
- File input `accept` attribute explicitly lists MIME types for iOS Safari compatibility: `audio/*,.mp3,.wav,.ogg,.m4a,.aac,.mp4,.aiff,.flac`
- Desktop uploads store `customRawBuf` alongside `customBuf` so mobile can decode lazily on first tap

---

## Keyboard Triggers

| Key | Pad |
|-----|-----|
| 7 | Kick |
| 8 | Snare |
| 9 | Hi-Hat |
| - | Clap |
| 4 | Rimshot |
| 5 | 808 Bass |
| 6 | Synth |
| = | Riser |
| 1 | Scratch |
| 2 | Air Horn |
| 3 | Laugh |
| Enter | Notif |
| 0 | Siren |
| . | Swoosh |
| Space | Stop All |

- Key repeat suppressed via held-key `Set`
- Keyboard disabled when focus is in an `input` or `select`

---

## Edit Mode

### Activation
- "Edit mode" button toggles editing state
- Button shows "Done" when active, with "Tap a pad to configure it" hint
- Tapping a pad in edit mode opens the unified config panel instead of firing sound

### Unified Config Panel
Opens below edit mode button when a pad is selected. Contains:

**Source toggle** — Built-in / Custom (segmented control)

**Built-in fields:**
- Sound dropdown (14 options with emoji labels)
- Label auto-populates from sound selection if not manually set

**Custom fields:**
- File drop zone — drag/drop or click to browse
- Accepted formats: `audio/*`, `.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.mp4`, `.aiff`, `.flac`
- Floating emoji picker (via `@emoji-mart/react`, loaded dynamically, SSR disabled)
- Emoji picker dismisses on outside click

**Shared fields:**
- Label input (20 char max)
- Color picker (6 color dots)

**Actions:**
- Save — upserts pad config to Supabase, uploads audio if custom
- Reset pad — removes custom audio from storage, restores default (requires modal confirmation)

---

## Status Bar
- Full-width pill below the stop bar
- Three states:
  - **Idle** — "Ready", neutral gray
  - **Active** — pad emoji + label, green tint — resets to idle when sound finishes
  - **Stopped** — "⏹ Stopped", red tint
- Text truncated with ellipsis on overflow

---

## Controls

### Volume
- Range slider (0–1, step 0.05)
- Directly updates master `GainNode`

### Sound Overlap Toggle
- Checkbox-style toggle
- Updates overlap mode state

---

## Board Name
- Displayed in top-left header as the wordmark
- Default: `{EMAIL_PREFIX}'S SOUNDBOARD` (e.g. `SAGE'S SOUNDBOARD`)
- Click to edit — inline input replaces label
- Save with Enter key or Save button; cancel with Escape or Cancel button
- Saved to `user_settings` table in Supabase, persists across devices and sessions
- Max 30 characters

---

## Persistence (Supabase)

### Tables

**`pad_configs`**
```
user_id         uuid (FK → auth.users)
pad_index       integer
sound           text
label           text
color           text
icon            text
custom_track_path text | null
custom_track_name text | null
updated_at      timestamptz
PRIMARY KEY: (user_id, pad_index)
```

**`user_settings`**
```
user_id         uuid (FK → auth.users)
board_name      text
updated_at      timestamptz
PRIMARY KEY: user_id
```

### Storage
- Bucket: `custom-tracks`
- Path: `{user_id}/pad-{index}`
- RLS policy: authenticated users can read/write/delete their own folder only

### Behavior
- On mount: fetch `user_settings` for board name + `pad_configs` for all pads
- Custom audio downloaded from storage, stored as raw `ArrayBuffer`, decoded lazily on first tap
- On save: upsert `pad_configs`, upload audio to storage if new file
- On reset pad: delete from storage, upsert defaults to `pad_configs`
- On reset all: client-side reset only (does not wipe Supabase — next save will overwrite)

---

## Responsive Design

| Breakpoint | Changes |
|------------|---------|
| ≤600px | Pad cell 92px, gap 8px, icon 22px, reduced page padding |
| ≤430px | Pad cell 76px, gap 6px, header stacks vertically, controls stack, vol slider full width, vsep hidden, stop bar row 48px |
| ≤380px | Pad cell 68px, gap 5px, labels hidden, minimal padding |

- Header stacks at 430px — board name on top row, email + sign out on bottom row full width
- Vol slider expands full width on mobile
- Sound overlap toggle expands full width on mobile
- Edit panel fields wrap on small screens

---

## Reset All
- Button at bottom of page
- Inline confirmation replaces button — "Cancel" or "Yes, reset everything"
- Stops all audio, resets all pads to defaults client-side
- Clears editing state and closes config panel

---

## Modal
- Used for destructive confirmations (reset pad)
- Full-screen overlay, centered card
- Cancel / Confirm buttons with danger or confirm styling

---

## File Structure
```
src/
  app/
    globals.css          — all styles
    page.tsx             — root redirect (/ → /soundboard or /auth)
    soundboard/
      page.tsx           — auth gate, passes user to Soundboard
    auth/
      page.tsx           — login page
  components/
    Soundboard.tsx       — main component
    Pad.tsx              — individual pad with flash animation ref
    Modal.tsx            — confirmation modal
  lib/
    supabase.ts          — singleton Supabase client
    constants.ts         — PAD_DEFS, defaultPads(), KEY_TO_INDEX, SOUND_LABELS, SOUND_ICONS, COLORS
    sounds.ts            — playSound() Web Audio synthesis
    types.ts             — PadState, PadConfig, ModalState, PendingFile
```

---

## Known Constraints
- No server-side route protection (no `middleware.ts`) — acceptable for current use case
- `localStorage` not used — all persistence via Supabase
- `customRawBuf` not persisted to DB — only used as in-memory cache for lazy decode
- Reset All does not delete Supabase records — next pad save will overwrite with new state
