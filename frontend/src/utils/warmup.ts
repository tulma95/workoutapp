import { roundWeight } from './weight'

const BAR_KG = 20

// Suggests a warm-up ramp up to a working weight, as display-only guidance
// (not logged, doesn't affect progression). Standard percentage ramp off the
// top working set, rounded to the gym's 2.5 kg increment.
export function computeWarmupSets(topWeight: number): Array<{ weight: number; reps: number }> {
  // Bail on bad input (NaN/Infinity from an empty Math.max) or weights too
  // light to warrant a ramp (working weight at/near the empty bar).
  if (!Number.isFinite(topWeight) || topWeight < BAR_KG + 20) return []

  const ramp = [
    { weight: BAR_KG, reps: 5 },
    { weight: roundWeight(topWeight * 0.5), reps: 5 },
    { weight: roundWeight(topWeight * 0.7), reps: 3 },
    { weight: roundWeight(topWeight * 0.85), reps: 2 },
  ]

  // Keep only strictly-ascending steps below the working weight (drop dupes
  // after rounding and anything that reaches the working weight).
  const result: Array<{ weight: number; reps: number }> = []
  for (const step of ramp) {
    if (step.weight >= topWeight) continue
    const prev = result[result.length - 1]
    if (prev && step.weight <= prev.weight) continue
    result.push(step)
  }
  return result
}
