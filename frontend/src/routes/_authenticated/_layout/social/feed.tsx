import { createFileRoute } from '@tanstack/react-router'
import { FeedTab } from '../../../../components/FeedTab'

export const Route = createFileRoute('/_authenticated/_layout/social/feed')({
  validateSearch: (search: Record<string, unknown>): { event?: number } => {
    const raw = search.event
    if (raw === undefined || raw === null) return {}
    const n = Number(raw)
    return Number.isInteger(n) && !isNaN(n) ? { event: n } : {}
  },
  component: FeedPage,
})

function FeedPage() {
  const { event } = Route.useSearch()
  return <FeedTab highlightEventId={event} />
}
