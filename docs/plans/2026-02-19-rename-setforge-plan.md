# Rename App to SetForge — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the app from "nSuns 4-Day LP" to "SetForge" across all user-facing surfaces.

**Architecture:** Simple text replacement in ~6 files. Service worker cache name bump forces refresh. No backend/DB changes.

**Tech Stack:** HTML, JSON manifest, React component, Playwright E2E

---

### Task 1: Update PWA manifest and HTML

**Files:**
- Modify: `frontend/public/manifest.webmanifest`
- Modify: `frontend/index.html`

**Step 1: Update manifest.webmanifest**

Replace the first 4 lines of the JSON body:
```json
{
  "name": "SetForge",
  "short_name": "SetForge",
  "description": "Plan-driven workout tracker with auto-calculated weights",
```

**Step 2: Update index.html**

Change the `<title>` tag:
```html
<title>SetForge</title>
```

Change the apple-mobile-web-app-title meta tag:
```html
<meta name="apple-mobile-web-app-title" content="SetForge" />
```

**Step 3: Commit**

```bash
git add frontend/public/manifest.webmanifest frontend/index.html
git commit -m "feat(036): rename app to SetForge in manifest and HTML"
```

---

### Task 2: Update Layout header and service worker

**Files:**
- Modify: `frontend/src/components/Layout.tsx:16`
- Modify: `frontend/public/sw.js:1`

**Step 1: Update Layout.tsx header**

Change the `<h1>` text from `Workout Tracker` to `SetForge`:
```tsx
<h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>SetForge</h1>
```

**Step 2: Update sw.js cache name**

Change line 1 from `'nsuns-v1'` to `'setforge-v1'`:
```js
const CACHE_NAME = 'setforge-v1';
```

**Step 3: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/public/sw.js
git commit -m "feat(036): rename header to SetForge, bump SW cache name"
```

---

### Task 3: Update E2E test assertion

**Files:**
- Modify: `e2e/pwa.spec.ts:31`

**Step 1: Update the iOS meta tag test**

Change line 31 from checking `'nSuns'` to `'SetForge'`:
```ts
await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'SetForge');
```

**Step 2: Run tests**

Run: `./run_test.sh`
Expected: All tests pass with the new name.

**Step 3: Commit**

```bash
git add e2e/pwa.spec.ts
git commit -m "test(036): update PWA E2E test for SetForge name"
```

---

### Task 4: Update CLAUDE.md references

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update CLAUDE.md**

Three changes:
1. Line 179 — update the SW cache name reference from `'nsuns-v1'` to `'setforge-v1'`

Lines 5 and 55 mention "nSuns 4-Day LP" as the plan name (not the app name) — these stay as-is since the plan is still called nSuns.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(036): update CLAUDE.md for SetForge cache name"
```

---

### Task 5: Run full test suite

**Step 1: Run all tests**

Run: `./run_test.sh`
Expected: All backend and E2E tests pass.
