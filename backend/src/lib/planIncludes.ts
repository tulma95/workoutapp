export const PLAN_DETAIL_INCLUDE = {
  days: {
    include: {
      exercises: {
        include: {
          exercise: true,
          tmExercise: true,
          sets: {
            orderBy: { setOrder: 'asc' as const },
          },
        },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
    orderBy: { dayNumber: 'asc' as const },
  },
} as const;

export const PLAN_SETS_INCLUDE = {
  days: {
    include: {
      exercises: {
        include: {
          sets: {
            orderBy: { setOrder: 'asc' as const },
          },
        },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
    orderBy: { dayNumber: 'asc' as const },
  },
} as const;
