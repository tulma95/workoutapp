import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getAchievements } from '../../../api/achievements'
import { AchievementsContent } from '../../../components/AchievementsContent'
import { LoadingSpinner } from '../../../components/LoadingSpinner'
import { queryKeys } from '../../../api/queryKeys'

export const Route = createFileRoute('/_authenticated/_layout/achievements')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData({
      queryKey: queryKeys.achievements.all(),
      queryFn: getAchievements,
    }),
  pendingComponent: LoadingSpinner,
  component: AchievementsPage,
})

function AchievementsPage() {
  const { data } = useSuspenseQuery({
    queryKey: queryKeys.achievements.all(),
    queryFn: getAchievements,
  })

  return <AchievementsContent achievements={data.achievements} />
}
