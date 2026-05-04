# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Recurso Musical — a Christian worship resource app. Has two runtimes:
- **Mobile app** (Expo/React Native) — tutorials, songbook (cancionero), multitrack backing tracks
- **Web backend** (Vercel serverless + Turso) — REST API + admin panel + landing page

## Commands

```bash
npm start          # Expo dev server (mobile)
npm run android    # Run on Android emulator/device
npm run web        # Expo web dev server
npm run build:web  # Export web to public/ (expo export --platform web)
```

No test runner is configured. TypeScript is checked by `tsc --noEmit` (strict mode via `expo/tsconfig.base`).

## Architecture

### Mobile app (`src/`)

**Data flow:** `AuthContext` fetches and caches an app token → components call `src/utils/turso.js` → which calls `src/api/api.ts` → which hits `/rm-api/api.php` (rewritten by Vercel to `/api/api`).

- `src/api/api.ts` — HTTP client. All requests include `X-RM-Token` header and a browser-like `User-Agent` (required because the old Hostgator server is behind Cloudflare WAF). Base URL is `EXPO_PUBLIC_API_URL ?? 'https://recursomusical.com.mx/rm-api/api.php'`.
- `src/utils/turso.js` — thin data-access layer wrapping `api.ts`. Components import from here, not from `api.ts` directly.
- `src/context/AuthContext.tsx` — fetches the app token via `APP_SECRET` on startup, stores in AsyncStorage under `rm_app_token`.
- `src/navigation/AppNavigator.tsx` — bottom-tab navigator: Tutoriales, Favoritos, Extras.

### Backend (`api/api.ts`)

Single Vercel serverless function handling all actions via `?action=` query param. Uses `@libsql/client` connecting to Turso. Environment variables `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are injected automatically by the Vercel–Turso integration (no manual config needed).

Key helpers inside the file:
- `toObj(row, columns)` — converts libSQL `Row` (index-based) to a plain object
- `requireAuth()` — validates `X-RM-Token` session, writes 401 and returns null on failure
- `setupDB()` — creates all tables (run once via `?action=setup&secret=...`)

DB tables: `tutoriales`, `push_tokens`, `rm_admin_users`, `rm_sessions`, `rm_login_attempts`, `multitracks`, `multitrack_pistas`.

Both tutorials and cancionero entries share the `tutoriales` table, distinguished by `tipo` column (`'tutorial'` | `'cancionero'`).

### Admin panel (`public/admin/`)

Static HTML/CSS/JS — no build step. Served by Vercel from `public/`. All API calls use relative path `/api/api`. Token stored in `localStorage` as `rm_admin_token`.

### Landing page (`public/index.html`)

Static page fetched by Vercel as the root. Loads tutorials from the API and displays them by category with multitrack download support.

## Vercel deployment

`vercel.json` sets `outputDirectory: "public"` and rewrites `/rm-api/api.php` → `/api/api` so existing mobile clients (pointing at the old PHP URL) continue to work without updates.

## SQLite gotchas

The Turso DB is SQLite. Differences from MySQL that matter here:
- Autoincrement: `INTEGER PRIMARY KEY AUTOINCREMENT`
- Current time: `datetime('now')`, relative: `datetime('now', '+30 days')`
- No `FIELD()` — use `CASE WHEN` for ordering
- `libSQL` rows are index-based; always use `toObj(row, columns)` before returning JSON
