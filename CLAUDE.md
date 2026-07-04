# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sailing-performance analytics for **Vakaros Atlas 2** recordings, deployed on **Cyon**
shared hosting at `vakaros.tying-the-knot.ch`. A React SPA (static build) talks to a small
PHP + MariaDB JSON API. All heavy lifting — parsing the device files and computing the
analysis — happens **client-side in TypeScript**; the backend only stores/serves data.

## Commands

```bash
# Frontend (from frontend/)
npm install
npm test                 # vitest: parser + analysis unit/integration tests
npm run test -- src/parse/parse.test.ts   # single test file
npm run build            # tsc + vite -> ../public
npm run typecheck

# Full-stack local run of the production build (from repo root)
php -S 127.0.0.1:8000 -t public scripts/dev-router.php

# API-only dev server (from repo root)
php -S 127.0.0.1:8000 api/index.php

# Package a deploy bundle -> ./deploy
./scripts/package.sh
```

Local backend needs a MariaDB/MySQL DB `vakaros` (`api/db/migrations.sql`), a `.env.vakaros`
(see `.env.example`), and a user created via `php api/bin/create-user.php <email> <pw>`.

## Architecture (the parts that span files)

- **Parse → unified model.** `frontend/src/parse/vkx.ts` walks the VKX binary row-by-row
  (every row key's payload size is in `ROW_SIZES`, including Vakaros-internal rows, so the
  walk never desyncs). It and `csv.ts` both emit the shared `Sample`/`ParsedTrack` types in
  `parse/types.ts`. The VKX quaternion→heel/trim/heading decode is validated against the CSV
  export in `parse/parse.test.ts` — that calibration is why the Euler conversion is trusted.
- **Analysis pipeline.** `analysis/analyze.ts` orchestrates: `maneuvers.ts` segments the
  track into straight sailing legs + turns (wind-agnostic), then `wind.ts` builds the hybrid
  wind model (instrument true-wind / shift markers / GPS estimate + manual TWS), then
  `legs.ts` classifies legs (upwind/reach/downwind) and labels maneuvers (tack/gybe/rounding),
  and `start.ts` reconstructs the start line + gun. `polar.ts` interpolates the TWA×TWS grid
  for % of target. There is a deliberate ordering dependency: maneuver segmentation must be
  wind-free so wind can be estimated from the resulting segments without a cycle.
- **Data flow for a session.** The browser parses + analyzes a file (`views/Import.tsx`),
  then POSTs the enriched `samples` + `stats` + cached `analysis` to `POST /api/sessions`.
  The API gzip-writes the bulky sample array to `storage/tracks/*.json.gz` and keeps only
  metadata/JSON in MariaDB. `SessionView.tsx` re-runs `analyze()` from the fetched samples so
  changing wind/polar re-derives everything live.
- **API shape.** `api/index.php` is a manual front-controller (method + path segments) with
  session-cookie auth + double-submit CSRF (`X-CSRF-Token`, issued via `GET /api/me`). Route
  handlers live in `api/routes/*.php`; everything is scoped to the authenticated user.

## Conventions / gotchas

- Units in the TS model: **degrees, knots, Unix ms**. VKX stores SOG in m/s, COG in radians,
  lat/lon as int×1e-7 — conversions happen only in the parser.
- The Atlas 2 records **no wind** without external instruments; polar comparison therefore
  depends on the estimated/manual TWD/TWS. Treat wind accuracy as tunable, not exact.
- Maneuver/leg detection thresholds live in `DEFAULTS` in `analysis/maneuvers.ts`; tune there.
- On Cyon the deployed web root is `public/` contents **plus** `api/`; `.env.vakaros` and
  `storage/` must sit **outside** the web root (the loader in `api/lib/db.php` checks 1 and
  2 levels above the web root). It's named `.env.vakaros` rather than `.env` so it doesn't
  collide with other apps' env files sharing the same account home directory. Note: if the
  subdomain's web root is itself a subfolder of the main domain's `public_html` (e.g.
  `public_html/vakaros/`), one level up is still `public_html` — the main domain's own web
  root — so `.env.vakaros`/`storage/` must go two levels up (the account home directory)
  instead.
