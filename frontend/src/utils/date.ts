// Shared, locale-stable date formatting so every surface renders dates the same
// way (e.g. "Jun 28, 2026") instead of the browser's locale default.
// Renders the UTC calendar day to match how the Progress page buckets dates
// (avoids an off-by-one for users ahead of UTC).
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
