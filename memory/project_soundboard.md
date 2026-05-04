---
name: Soundboard project
description: Web-based soundboard app built with Next.js 15 and Supabase, with a public demo mode
type: project
---

Next.js 15 soundboard app at /Users/evo/Documents/Claude/Soundboard.

**Why:** User wants a personal soundboard with custom audio uploads, keyboard triggers, and per-user cloud persistence — plus a public demo mode for portfolio purposes.

**Stack:** Next.js 15 App Router, TypeScript, Supabase (auth + postgres + storage), Web Audio API. No CSS framework — single globals.css file.

**How to apply:** Preserve the warm neutral palette (--bg: #f5f4f0), the 4×4 Apple numpad grid layout, and existing CSS class naming. Never add Tailwind or CSS modules.

Key facts:
- Supabase project: https://aprrdlmtiszvuimmctrn.supabase.co
- Storage bucket: `custom-tracks` (private)
- DB tables: `pad_configs` (user_id, pad_index 0-13, sound, label, color, icon, custom_track_path, custom_track_name), `user_settings` (user_id, board_name, theme)
- 14 pads per board, up to 5 boards per user
- Keyboard map: numpad keys 7 8 9 - 4 5 6 + 1 2 3 Enter 0 . → pads 0–13
- 14 built-in synth sounds in src/lib/sounds.ts (Web Audio API, no audio files)
- Demo mode at /demo — no auth, session-only, two fixed boards (custom clips + synth)
- .env.local is gitignored and contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Deployment: Vercel auto-deploys from main branch on GitHub
