import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export async function invalidateAfterWorkoutComplete(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.workout.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workout.calendarAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.trainingMaxes.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.social.feed() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.social.friends() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all() }),
  ]);
}

export async function invalidateAfterWorkoutCancel(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.workout.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workout.calendarAll() }),
  ]);
}

export function removeCacheAfterPlanSwitch(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: queryKeys.plan.current() });
  queryClient.removeQueries({ queryKey: queryKeys.trainingMaxes.all() });
  queryClient.removeQueries({ queryKey: queryKeys.progress.all() });
  queryClient.removeQueries({ queryKey: queryKeys.schedule.all() });
}

export async function invalidateAfterTmUpdate(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.trainingMaxes.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.progress.all() }),
  ]);
}
