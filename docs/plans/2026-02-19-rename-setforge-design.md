# Rename App: nSuns → SetForge

## Summary

Rename the application from "nSuns 4-Day LP" to "SetForge" — a plan-agnostic name that reflects the app's core value: forging workouts from configurable training plans.

## Changes

### User-facing
- `frontend/index.html` — title and apple-mobile-web-app-title → "SetForge"
- `frontend/public/manifest.webmanifest` — name, short_name, description
- `frontend/src/components/Layout.tsx` — header text → "SetForge"
- `frontend/public/sw.js` — cache name → `setforge-v1` (forces cache refresh)

### Docs & tests
- `CLAUDE.md` — update project description references
- `e2e/pwa.spec.ts` — update assertions checking title/manifest values

### Not changing
- nSuns plan name in seed data stays "nSuns 4-Day LP" (plan name, not app name)
- Database names, env vars, Docker config (`treenisofta`) — internal, no user impact
- Git repo name — separate concern
