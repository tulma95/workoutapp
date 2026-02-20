import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getAchievements } from '../../../api/achievements'
import { AchievementsContent } from '../../../components/AchievementsContent'
import { LoadingSpinner } from '../../../components/LoadingSpinner'

export const Route = createFileRoute('/_authenticated/_layout/achievements')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: ['achievements'],
      queryFn: getAchievements,
    }),
  pendingComponent: LoadingSpinner,
  component: AchievementsPage,
})

function AchievementsPage() {
  const { data } = useSuspenseQuery({
    queryKey: ['achievements'],
    queryFn: getAchievements,
  })

  return <AchievementsContent achievements={data.achievements} />
}
