---
name: Soundboard project
description: Web-based soundboard app built with Next.js 15 and Supabase
type: project
---

Next.js 15 soundboard app at /Users/evo/Documents/Claude/Soundboard.

**Why:** User wants a personal soundboard with custom audio uploads, keyboard triggers, and per-user cloud persistence.

**Stack:** Next.js 15 App Router, TypeScript, Supabase (auth + postgres + storage), Web Audio API. No CSS framework — global CSS matching a provided HTML prototype design.

**How to apply:** When modifying this project, preserve the warm neutral color palette (--bg: #f5f4f0), the 4×4 pad grid layout, and the existing CSS class naming conventions.

Key facts:
- Supabase project: https://aprrdlmtiszvuimmctrn.supabase.co
- Storage bucket: `custom-tracks` (private)
- DB table: `pad_configs` (user_id, pad_index 0-15, sound, label, color, icon, custom_track_path, custom_track_name)
- Keyboard map: 1 2 3 4 5 6 7 8 9 0 - = q w e r → pads 0–15
- 16 built-in synth sounds in src/lib/sounds.ts (all Web Audio API, no audio files)
- Database migration SQL: supabase/migrations/001_setup.sql (needs to be run in Supabase SQL editor)
- .env.local is gitignored and contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
