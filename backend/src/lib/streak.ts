export function calculateStreak(days: string[]): number {
  if (days.length === 0) return 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  const unique = [...new Set(days.filter((d) => d <= todayStr))].sort().reverse();

  if (unique.length === 0) return 0;

  let streak = 0;
  let expected = todayStr;

  if (unique[0] !== undefined && unique[0] < expected) {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (unique[0] !== yesterdayStr) return 0;
    expected = yesterdayStr;
  }

  for (const day of unique) {
    if (day === expected) {
      streak++;
      const prev = new Date(expected + 'T00:00:00Z');
      prev.setUTCDate(prev.getUTCDate() - 1);
      expected = prev.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  return streak;
}
