# Implementation Plan: TM Progression Charts

MVP of the progression charts feature (see `docs/features/003-progression-charts.md`).
Scope: TM progression line chart only. No AMRAP chart, no volume chart, no frequency chart.

## Decisions

- **No chart library** -- custom SVG line chart component (zero dependencies, ~200 lines)
- **No new backend endpoint** -- use existing `GET /api/training-maxes/:exercise/history` (4 calls, one per exercise)
- **New "Progress" tab** as 4th item in bottom nav (Dashboard, History, Progress, Settings)
- **Unrounded weight values** on chart Y-axis and tooltips to show real progression even when gym rounding would flatten it
- **Lazy load** the Progress page via `React.lazy()` + `Suspense`

## Steps

### 1. Create SVG line chart component

**File**: `frontend/src/components/TMProgressionChart.tsx` + `.css`

Custom SVG line chart that accepts time-series data for multiple exercises:

```typescript
interface DataPoint { date: string; weight: number }
interface ChartSeries { name: string; color: string; data: DataPoint[] }
interface Props {
  series: ChartSeries[]
  unit: 'kg' | 'lb'
  timeRange: '1m' | '3m' | '6m' | 'all'
}
```

SVG implementation details:
- `<svg>` with viewBox, responsive via CSS `width: 100%`
- Y-axis: weight values (unrounded, converted to user unit), 4-5 tick marks
- X-axis: dates, abbreviated month labels (Jan, Feb, etc.)
- One `<polyline>` per exercise series with distinct stroke color
- Data points as small `<circle>` elements
- Tap/click a circle to show tooltip with exact date + weight
- Padding: 40px left (Y labels), 20px bottom (X labels), 10px top/right
- Colors: Bench=#2563eb (primary blue), Squat=#dc2626 (red), OHP=#16a34a (green), Deadlift=#f59e0b (amber)
- Empty state: centered text "Complete workouts to track progress"

### 2. Create time range selector component

**File**: `frontend/src/components/TimeRangeSelector.tsx` + `.css`

Horizontal segmented control with options: 1M, 3M, 6M, All.

- Row of 4 buttons, `min-height: 2.75rem` (44px touch target)
- Active button: `background: var(--primary)`, white text
- Inactive: `background: var(--bg-card)`, `border: 1px solid var(--border)`
- `border-radius: var(--space-sm)` on group, square inner edges
- Full width of container

### 3. Create exercise legend/toggle component

**File**: `frontend/src/components/ExerciseLegend.tsx` + `.css`

Row of toggleable exercise pills below the chart:

- Horizontal flex wrap, gap `var(--space-sm)`
- Each pill: colored dot + exercise name, `min-height: 2.75rem`, tap to toggle visibility
- Active: solid border matching exercise color, text colored
- Inactive: muted border, strikethrough text, 50% opacity
- State managed via parent (controlled component)

### 4. Create Progress page

**File**: `frontend/src/pages/ProgressPage.tsx` + `.css`

Page structure:
```
<h2>Progress</h2>
<TimeRangeSelector value={range} onChange={setRange} />
<TMProgressionChart series={filteredSeries} unit={unit} timeRange={range} />
<ExerciseLegend exercises={exercises} visible={visibleExercises} onToggle={toggle} />
```

Data fetching:
- On mount, get active plan exercises from existing `getTrainingMaxes()` (returns current TMs with exercise slugs)
- For each exercise slug, call `getTrainingMaxHistory(slug)` in parallel via `Promise.all`
- Convert weights using `convertWeight()` (unrounded) before passing to chart
- Filter by time range in `useMemo`
- Loading state: `LoadingSpinner` component
- Error state: `ErrorMessage` component

### 5. Add route and nav tab

**Files to edit**:
- `frontend/src/App.tsx` -- add lazy import + `<Route path="/progress" element={<ProgressPage />} />`
- `frontend/src/components/Layout.tsx` -- add Progress link between History and Settings in bottom nav

Lazy loading:
```typescript
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
// In route: <Suspense fallback={<LoadingSpinner />}><ProgressPage /></Suspense>
```

### 6. Handle edge cases

In `ProgressPage.tsx` / `TMProgressionChart.tsx`:
- **0 data points (no plan)**: Show message "Subscribe to a plan to track progress" with link to `/select-plan`
- **1 data point per exercise**: Render single dot with value label (no line)
- **User changes unit preference**: `useMemo` depends on `user.unitPreference`, re-computes automatically
- **Discarded exercises**: Only fetch history for exercises in current plan's TM list
- **Gaps in data**: Line connects consecutive points (no interpolation needed -- TMs only change on workout completion, so gaps are normal)

### 7. Write E2E test

**File**: `e2e/progress.spec.ts`

Test flow:
1. Register user, subscribe to plan, set up TMs
2. Start and complete 2 workouts (different days) to generate TM progression data
3. Navigate to Progress tab
4. Assert: chart SVG container is visible
5. Assert: exercise legend shows all 4 exercises
6. Assert: time range selector is visible
7. Tap an exercise legend pill, assert it toggles (opacity change or class change)
8. Tap different time ranges, assert chart updates (SVG re-renders)

Keep assertions lightweight -- verify DOM elements exist, don't assert pixel positions.

## Files Summary

| Action | File |
|--------|------|
| Create | `frontend/src/components/TMProgressionChart.tsx` |
| Create | `frontend/src/components/TMProgressionChart.css` |
| Create | `frontend/src/components/TimeRangeSelector.tsx` |
| Create | `frontend/src/components/TimeRangeSelector.css` |
| Create | `frontend/src/components/ExerciseLegend.tsx` |
| Create | `frontend/src/components/ExerciseLegend.css` |
| Create | `frontend/src/pages/ProgressPage.tsx` |
| Create | `frontend/src/pages/ProgressPage.css` |
| Edit   | `frontend/src/App.tsx` |
| Edit   | `frontend/src/components/Layout.tsx` |
| Create | `e2e/progress.spec.ts` |

No backend changes. No schema changes. No new dependencies.
