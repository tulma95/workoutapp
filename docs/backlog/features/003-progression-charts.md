# Feature: Progression Charts & Statistics

**Priority**: High
**Effort**: Medium (10-15 hours)
**Impact**: Visual motivation, helps users see long-term progress

## Problem

Users can see their current training maxes on the dashboard but have no visual way to track progress over time. The TM history exists in the database (append-only training_maxes table) but there's no UI to visualize it. For a linear progression program, seeing the upward trend is a key motivator.

## Solution

Add a Statistics/Progress page with charts showing training max progression, estimated 1RM trends, and workout volume over time.

## Pages & Charts

### New Page: `/progress`

Added to bottom navigation as the 3rd tab (Dashboard, Progress, History, Settings).

### Chart 1: Training Max Progression (Primary)

**What it shows:** Line chart with 4 colored lines, one per lift (Bench, Squat, OHP, Deadlift), showing TM values over time.

**Data source:** `GET /api/training-maxes/:exercise/history` for each exercise.

**Interactions:**
- Tap a data point to see exact value and date
- Toggle individual lifts on/off
- Time range selector: 1 month / 3 months / 6 months / All

**Why it matters:** This is THE metric for nSuns. If TMs are going up, the program is working.

### Chart 2: AMRAP Performance

**What it shows:** Scatter/line chart showing reps achieved on the progression AMRAP set over time, per exercise.

**Data source:** New API endpoint `GET /api/stats/amrap-history?exercise=bench` that queries workout_sets for AMRAP sets with highest percentage per workout.

**Why it matters:** AMRAP reps directly drive TM progression. Declining AMRAP reps (e.g., consistently hitting only 1-2 on 95%) signals the need to deload.

### Chart 3: Workout Frequency

**What it shows:** Simple heatmap or bar chart showing workouts per week over time. Similar to GitHub contribution graph.

**Data source:** `GET /api/workouts/history` (already exists, just need to aggregate).

**Why it matters:** Consistency is the #1 predictor of progress. Visual accountability.

## Technical Design

### Chart Library

**Recommended: uPlot** (15KB gzipped)
- Fastest canvas-based chart library
- Minimal bundle size (important for PWA)
- Good for time-series data
- No dependencies

**Alternative: Chart.js** (35KB gzipped)
- More features, easier API
- Better accessibility
- Larger community

Decision: Start with **uPlot** for bundle size. The charts are simple line/scatter plots.

### New API Endpoint

```
GET /api/stats/amrap-history?exercise=bench&from=2026-01-01&to=2026-02-12
```

Response:
```json
{
  "exercise": "bench",
  "data": [
    { "date": "2026-01-15", "weight": 72.5, "prescribedReps": 1, "actualReps": 3, "percentage": 95 },
    { "date": "2026-01-22", "weight": 75.0, "prescribedReps": 1, "actualReps": 2, "percentage": 95 }
  ]
}
```

### Frontend Components

- `ProgressPage` - Container page with chart tabs/sections
- `TMProgressionChart` - Training max line chart
- `AmrapChart` - AMRAP performance scatter/line chart
- `FrequencyChart` - Workout frequency heatmap/bars
- `TimeRangeSelector` - 1M / 3M / 6M / All toggle
- `ExerciseFilter` - Toggle individual exercises on/off

### Data Fetching

Fetch all history on page load (data is small - few hundred rows max for most users). Cache in memory, no need for complex state management.

## UI Design

### Progress Page Layout
```
┌─────────────────────────────┐
│ Training Max Progression     │
│ [1M] [3M] [6M] [All]       │
│                              │
│  ┌──────────────────────┐   │
│  │  📈 Line chart        │   │
│  │  Bench ── Squat ──    │   │
│  │  OHP ── Deadlift ──   │   │
│  └──────────────────────┘   │
│                              │
│ ● Bench  ● Squat            │
│ ● OHP    ● Deadlift         │
├─────────────────────────────┤
│ AMRAP Performance            │
│ [Bench ▼]                    │
│  ┌──────────────────────┐   │
│  │  📊 Scatter plot       │   │
│  │  Reps achieved vs time │   │
│  └──────────────────────┘   │
├─────────────────────────────┤
│ Workout Frequency            │
│  ┌──────────────────────┐   │
│  │  █ █ ██ █ ███ ██ █   │   │
│  │  Workouts per week     │   │
│  └──────────────────────┘   │
└─────────────────────────────┘
```

## Edge Cases

- New users with < 2 data points: Show "Complete more workouts to see trends" message
- Users who skip exercises: Handle missing data gracefully (gaps in lines)
- Unit conversion: Charts should display in user's preferred unit (kg/lb)
- Very long history: Aggregate by week/month for All time view

## Testing

- E2E: Progress page loads with charts after completing 2+ workouts
- E2E: Time range selector filters data correctly
- E2E: Exercise toggle hides/shows lines
- E2E: Unit preference reflected in chart labels
- Backend: AMRAP history endpoint returns correct data
