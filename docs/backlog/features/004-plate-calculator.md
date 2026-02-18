# Feature: Plate Calculator

**Priority**: Medium
**Effort**: Low-Medium (4-6 hours)
**Impact**: Practical gym convenience, reduces mental math

## Problem

When the app says "load 72.5kg", the user has to mentally figure out which plates to put on the bar. This is annoying, especially for odd weights, and gets worse when fatigued during heavy sets.

## Solution

A plate breakdown display that shows which plates to load on each side of the bar. Accessible from any set in the workout view.

## User Experience

1. During a workout, user sees a set: "72.5 kg x 5"
2. User taps the weight to see plate breakdown
3. Popup/tooltip shows: "Bar (20kg) + 2x10kg + 2x5kg + 2x1.25kg per side"
4. User loads the bar and dismisses

## Plate Configuration

### Default Available Plates

**Metric (kg):** 25, 20, 15, 10, 5, 2.5, 1.25
**Imperial (lb):** 45, 35, 25, 10, 5, 2.5

### Bar Weight

- Default: 20kg / 45lb (standard Olympic barbell)
- Configurable in Settings (for users with different bars)

### Calculation Algorithm

```
weight_per_side = (total_weight - bar_weight) / 2

Greedy algorithm: starting from heaviest plate,
add as many as possible, move to next smaller plate.
```

Example: 72.5kg with 20kg bar
- Per side: (72.5 - 20) / 2 = 26.25kg
- 1x25kg = 25kg, remaining 1.25kg
- 1x1.25kg = 1.25kg, remaining 0kg
- Result: **25 + 1.25** per side

## Technical Design

### Frontend Only

No backend changes. Pure calculation utility.

**New components:**
- `PlateCalculator` - Modal/popup showing plate breakdown
- `PlateVisual` - Optional: colored bar diagram showing plates

**Utility function:**
```typescript
interface PlateBreakdown {
  barWeight: number;
  perSide: { plate: number; count: number }[];
  isExact: boolean; // false if weight can't be made exactly
}

function calculatePlates(
  totalWeight: number,
  barWeight: number,
  availablePlates: number[],
  unit: 'kg' | 'lb'
): PlateBreakdown
```

### Settings

Stored in `localStorage`:
```json
{
  "plateCalculator": {
    "barWeight": 20,
    "availablePlates": [25, 20, 15, 10, 5, 2.5, 1.25]
  }
}
```

## UI Design

### Plate Breakdown Popup
```
┌──────────────────────────┐
│  72.5 kg                  │
│                           │
│  Bar: 20 kg               │
│  Each side:               │
│    1 × 25 kg              │
│    1 × 1.25 kg            │
│                           │
│         [Close]           │
└──────────────────────────┘
```

### Optional: Visual Bar Diagram
```
  ┃█████┃███┃░┃ ═══════ ┃░┃███┃█████┃
   25kg  1.25          1.25  25kg
```

Color-coded plates (red=25, blue=20, yellow=15, green=10, white=small plates) - matches standard competition plate colors.

### Trigger

Tap on the weight number in any SetRow to open the plate calculator for that weight.

## Edge Cases

- Weight less than bar weight: Show "Weight is less than bar"
- Weight equals bar weight: Show "Empty bar"
- Weight can't be made exactly with available plates: Show closest possible weight and indicate rounding
- Custom bar weights (EZ bar 10kg, trap bar 25kg): Configurable in settings

## Testing

- E2E: Tap weight in workout, plate calculator appears
- E2E: Correct plate breakdown for known weights
- E2E: Works with both kg and lb
- E2E: Custom bar weight setting applies
