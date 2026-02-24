export const queryKeys = {
  user: {
    me: () => ['user', 'me'] as const,
  },
  plan: {
    current: () => ['plan', 'current'] as const,
    list: () => ['plan', 'list'] as const,
  },
  workout: {
    all: () => ['workout', 'all'] as const,
    current: () => ['workout', 'current'] as const,
    calendar: (year: number, month: number) => ['workout', 'calendar', year, month] as const,
    calendarAll: () => ['workout', 'calendar'] as const,
  },
  trainingMaxes: {
    all: () => ['trainingMaxes', 'all'] as const,
  },
  progress: {
    all: () => ['progress', 'all'] as const,
  },
  schedule: {
    all: () => ['schedule', 'all'] as const,
  },
  achievements: {
    all: () => ['achievements', 'all'] as const,
  },
  exercises: {
    list: () => ['exercises', 'list'] as const,
  },
  social: {
    feed: () => ['social', 'feed'] as const,
    feedComments: (eventId: number) => ['social', 'feed', eventId, 'comments'] as const,
    friends: () => ['social', 'friends'] as const,
    friendRequests: () => ['social', 'friendRequests'] as const,
    leaderboard: () => ['social', 'leaderboard'] as const,
    leaderboardE1rm: () => ['social', 'leaderboard', 'e1rm'] as const,
    search: (query: string) => ['social', 'search', query] as const,
    searchAll: () => ['social', 'search'] as const,
  },
  admin: {
    plans: () => ['admin', 'plans'] as const,
    exercises: () => ['admin', 'exercises'] as const,
  },
};
