// Standard kg plate denominations available per side, heaviest first.
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

export const DEFAULT_BAR_KG = 20
export const BAR_OPTIONS_KG = [20, 15, 10]

export type PlateGroup = { weight: number; count: number }

// Computes the plates to load on ONE side of the bar for a target weight.
// Returns grouped plates (heaviest first) and any remainder that can't be made
// with the available plates (0 for the app's 2.5 kg-rounded weights).
export function computePlatesPerSide(
  targetWeight: number,
  barWeight: number = DEFAULT_BAR_KG,
): { groups: PlateGroup[]; leftover: number } {
  const perSide = (targetWeight - barWeight) / 2
  if (perSide <= 0) return { groups: [], leftover: 0 }

  const groups: PlateGroup[] = []
  let remaining = perSide
  for (const plate of PLATES_KG) {
    let count = 0
    while (remaining >= plate - 1e-9) {
      count += 1
      remaining -= plate
    }
    if (count > 0) groups.push({ weight: plate, count })
  }

  return { groups, leftover: Math.round(remaining * 100) / 100 }
}
