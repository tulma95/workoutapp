import { createFileRoute } from '@tanstack/react-router'
import { LeaderboardTab } from '../../../../components/LeaderboardTab'

export const Route = createFileRoute('/_authenticated/_layout/social/leaderboard')({
  component: LeaderboardPage,
})

function LeaderboardPage() {
  return <LeaderboardTab />
}
