# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

No test framework is configured.

## What This App Does

**nittei** is an anonymous schedule coordination app. Guests respond to event polls privately — only the host sees individual answers. Guests can also set "hidden conditions" (e.g., "I'll attend only if person X also attends"), which are evaluated server-side. UI is in Japanese.

## Architecture

**Stack:** Next.js App Router, React 19, TailwindCSS 4, Supabase (PostgreSQL with RLS), TypeScript.

**No ORM** — all DB access goes through the Supabase JS client directly (`@supabase/supabase-js`).

### Key Directories

```
src/app/
├── page.tsx                  # Home page: event creation form
├── lib/
│   ├── supabase.ts           # Client-side Supabase instance
│   ├── supabase/server.ts    # Server-side Supabase (service role key)
│   └── host-session.ts       # HMAC-SHA256 session signing/verification
├── event/[id]/
│   ├── page.tsx              # Guest response form (main app flow)
│   └── host/page.tsx         # Host dashboard: aggregated responses + date confirmation
└── api/
    ├── events/create/route.ts
    ├── events/[id]/
    │   ├── public/route.ts         # Public event data (no auth)
    │   ├── host-login/route.ts     # Verifies host password, sets cookie
    │   ├── host-data/route.ts      # Protected host aggregate (cookie-checked)
    │   ├── answer-upsert/route.ts  # Guest submit/update response
    │   ├── answer-restore/route.ts # Restore previous guest answer by name+passcode
    │   └── feedback/route.ts       # Beta feedback submission
    ├── calendar/                   # Google Calendar CRUD
    └── admin/stats/route.ts        # Admin stats (API key protected)
```

### Auth Model

Two independent auth layers:

1. **Host auth** — HMAC-SHA256(`eventId:password`) signed into a cookie named `host_auth_{eventId}`. Verified via timing-safe comparison in `host-session.ts`. Requires `HOST_SESSION_SECRET` env var.

2. **Guest auth** — Self-identified by name + 4-digit passcode. No server verification; passcode is only used to enable response restoration (`answer-restore`).

### Database Tables (Supabase)

- `events` — id, title, password (hashed), candidate_dates (array), confirmed_date, google_event_id, deadline
- `answers` — event_id, user_name, pass_code, selections (date→ok/ng map), target_user_name (encodes hidden conditions), email_guest, home_station, guest_suggestion
- `feedback` — type, text, contact_info
- `logs` — event activity tracking

Hidden conditions are encoded into `target_user_name` as a string, not a dedicated column.

### Styling Convention

`event/[id]/page.tsx` (guest form) uses mostly **inline styles**. The host dashboard and other pages use **Tailwind classes**. This is intentional — the guest form grew organically.

### Known Limitations (intentional, not bugs)

- Some business logic still runs client-side — the developer console can expose response data. The README notes a planned migration to fully server-side Route Handlers with stricter RLS.
- AI place/area suggestion endpoints (`/api/premium/`) are implemented but disabled due to rate limits and security concerns with handling location data.

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
HOST_SESSION_SECRET
ADMIN_STATS_KEY
GOOGLE_GENERATIVE_AI_API_KEY
GEOAPIFY_API_KEY
NEXT_PUBLIC_BASE_URL
```
