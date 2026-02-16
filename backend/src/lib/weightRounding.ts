export function roundWeight(weight: number): number {
  if (weight === 0) return 0;
  return Math.round(weight / 2.5) * 2.5;
}
