export function roundWeight(weight: number, unit: 'kg' | 'lb'): number {
  if (weight === 0) return 0;
  const increment = unit === 'kg' ? 2.5 : 5;
  return Math.round(weight / increment) * increment;
}
