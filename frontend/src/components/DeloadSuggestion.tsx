import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../api/queryKeys'
import { getStalls, updateTrainingMax } from '../api/trainingMaxes'
import { formatWeight } from '../utils/weight'
import { useToast } from './Toast'
import type { Stall } from '../api/schemas'
import styles from './DeloadSuggestion.module.css'

export function DeloadSuggestion() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: stalls } = useQuery({
    queryKey: queryKeys.trainingMaxes.stalls(),
    queryFn: getStalls,
  })

  const deload = useMutation({
    mutationFn: (stall: Stall) =>
      updateTrainingMax(stall.exerciseSlug, stall.suggestedTM, 'Deload'),
    onSuccess: (_data, stall) => {
      toast.success(`${stall.exerciseName} deloaded to ${formatWeight(stall.suggestedTM)}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingMaxes.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.trainingMaxes.stalls() })
    },
    onError: () => toast.error('Could not apply the deload'),
  })

  if (!stalls || stalls.length === 0) return null

  return (
    <div className={styles.wrap} data-testid="deload-suggestion">
      {stalls.map((stall) => (
        <section key={stall.exerciseSlug} className={styles.card}>
          <div className={styles.text}>
            <span className={styles.title}>{stall.exerciseName} has stalled</span>
            <span className={styles.detail}>
              No progress in 3 sessions. Deload {formatWeight(stall.currentTM)} →{' '}
              {formatWeight(stall.suggestedTM)} TM?
            </span>
          </div>
          <button
            type="button"
            className={styles.button}
            onClick={() => deload.mutate(stall)}
            disabled={deload.isPending}
          >
            {deload.isPending && deload.variables?.exerciseSlug === stall.exerciseSlug
              ? 'Deloading…'
              : 'Deload'}
          </button>
        </section>
      ))}
    </div>
  )
}
