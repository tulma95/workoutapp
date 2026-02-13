# Feature Backlog

## Current State

The nSuns 4-Day LP Workout Tracker is **feature-complete** per the original spec. All 17 API endpoints are implemented, all 7 pages work, and there's solid test coverage (1,756 lines backend + 1,134 lines E2E). The core workout flow - from setup to progression - works end to end.

## Prioritized Feature Roadmap

### Tier 1: Quick Wins (1-3 hours each, high impact)

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| [007](007-screen-wake-lock.md) | Screen Wake Lock | 1-2h | Essential gym UX. Screen stays on during workouts. Zero UI, just a hook. |
| [006](006-workout-progress-indicator.md) | Workout Progress Indicator | 2-3h | "8/17 sets" bar at top of workout page. Pure frontend, simple CSS. |

### Tier 2: Core UX Improvements (4-12 hours each)

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| [001](001-rest-timer.md) | Rest Timer | 8-12h | Auto-starting countdown between sets. #1 requested feature in workout apps. |
| [004](004-plate-calculator.md) | Plate Calculator | 4-6h | Shows which plates to load. Pure frontend utility. |
| [005](005-dark-mode.md) | Dark Mode | 6-8h | System-aware theming. Already using CSS custom properties. |
| [008](008-pr-detection.md) | PR Detection | 6-8h | Real-time personal record banners. High motivation factor. |

### Tier 3: Major Features (10-30 hours each)

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| [003](003-progression-charts.md) | Progression Charts | 10-15h | TM trends, AMRAP history, workout frequency. New page + chart library. |
| [002](002-pwa-offline.md) | PWA + Offline | 20-30h | Installable, works offline. Phased: basic PWA → offline workouts → wake lock. |

### Tier 4: Nice-to-Have

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| [009](009-deload-detection.md) | Deload Detection | 4-6h | Suggests deload after 3 consecutive stalls. Helps avoid overtraining. |
| [010](010-workout-notes.md) | Workout Notes | 3-4h | Free-text notes on workouts. Simple DB column + textarea. |

## Recommended Implementation Order

1. **Screen Wake Lock** (007) - Tiny effort, immediate gym UX improvement
2. **Workout Progress Indicator** (006) - Quick win, visible improvement
3. **Rest Timer** (001) - Core workout feature, biggest single UX gain
4. **Dark Mode** (005) - Baseline modern app expectation
5. **Plate Calculator** (004) - Practical gym convenience
6. **PR Detection** (008) - Motivation and delight
7. **Progression Charts** (003) - Long-term value, visual progress
8. **PWA + Offline** (002) - Biggest effort but transforms reliability
9. **Deload Detection** (009) - Smart coaching feature
10. **Workout Notes** (010) - Quality of life

## Features Considered and Rejected

| Feature | Why Rejected |
|---------|--------------|
| Custom accessory exercises | Out of scope for nSuns 4-day LP. Fixed program by design. |
| Social features / sharing | Single-user app. Adds complexity without clear value. |
| Workout reminders (push notifications) | Requires VAPID backend setup, limited iOS support. Low ROI. |
| Data export/import | Low priority. Can be added later if users request it. |
| Swipe gestures for set completion | Accessibility concern. Tap targets work well on mobile. |
| Workout streak counter | Gamification can feel manipulative. Charts cover consistency tracking. |
