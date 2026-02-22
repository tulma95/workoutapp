import { z } from 'zod';

// Workout schemas
export const WorkoutSetSchema = z.object({
  id: z.number(),
  workoutId: z.number(),
  exercise: z.string(),
  exerciseOrder: z.number(),
  setOrder: z.number(),
  prescribedWeight: z.number(),
  prescribedReps: z.number(),
  isAmrap: z.boolean(),
  isProgression: z.boolean().optional(),
  actualReps: z.number().nullable(),
  completed: z.boolean(),
  createdAt: z.string(),
});

export const ProgressionResultSchema = z.object({
  exercise: z.string(),
  previousTM: z.number(),
  newTM: z.number(),
  increase: z.number(),
});

export const WorkoutSchema = z.object({
  id: z.number(),
  userId: z.number(),
  dayNumber: z.number(),
  status: z.enum(['in_progress', 'completed', 'discarded']),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  sets: z.array(WorkoutSetSchema),
  progressions: z.array(ProgressionResultSchema).optional().default([]),
  isCustom: z.boolean().optional().default(false),
});

export const WorkoutHistoryItemSchema = z.object({
  id: z.number(),
  dayNumber: z.number(),
  status: z.enum(['in_progress', 'completed', 'discarded']),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  isCustom: z.boolean().optional().default(false),
});

export const CalendarWorkoutSchema = z.object({
  id: z.number(),
  dayNumber: z.number(),
  status: z.enum(['in_progress', 'completed', 'discarded']),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  isCustom: z.boolean().optional().default(false),
});

export const CompleteWorkoutResponseSchema = z.object({
  workout: WorkoutSchema,
  // Support both old (fallback) and new (plan-driven) formats
  progression: ProgressionResultSchema.nullable().optional(),
  progressions: z.array(ProgressionResultSchema).optional(),
  newAchievements: z.array(z.object({ slug: z.string(), name: z.string(), description: z.string() })).optional().default([]),
});

export const AchievementSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  unlockedAt: z.string().nullable(),
  workoutId: z.number().nullable(),
});

export const AchievementsResponseSchema = z.object({
  achievements: z.array(AchievementSchema),
});

export const ScheduledDaySchema = z.object({
  date: z.string(),
  dayNumber: z.number(),
  planDayName: z.string().nullable(),
});

export const ScheduleEntrySchema = z.object({
  dayNumber: z.number(),
  weekday: z.number(),
});

export const ScheduleResponseSchema = z.object({
  schedule: z.array(ScheduleEntrySchema),
});

export const WorkoutCalendarResponseSchema = z.object({
  workouts: z.array(CalendarWorkoutSchema),
  scheduledDays: z.array(ScheduledDaySchema).default([]),
});

// Auth schemas
export const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  username: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
});

// Training Max schemas
export const TrainingMaxSchema = z.object({
  id: z.number(),
  userId: z.number(),
  exercise: z.string(),
  weight: z.number(),
  effectiveDate: z.string(),
  reason: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const OneRepMaxesSchema = z.object({
  bench: z.number(),
  squat: z.number(),
  ohp: z.number(),
  deadlift: z.number(),
});

export const SetupResponseSchema = z.array(TrainingMaxSchema);

// Plan schemas
export const ExerciseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  muscleGroup: z.string().nullable().optional(),
  category: z.string(),
  isUpperBody: z.boolean(),
});

export const PlanDayExerciseSchema = z.object({
  id: z.number(),
  planDayId: z.number(),
  exerciseId: z.number(),
  sortOrder: z.number(),
  tmExerciseId: z.number(),
  displayName: z.string().nullable(),
  exercise: ExerciseSchema,
  tmExercise: ExerciseSchema,
});

export const PlanDaySchema = z.object({
  id: z.number(),
  planId: z.number(),
  dayNumber: z.number(),
  name: z.string().nullable(),
  exercises: z.array(PlanDayExerciseSchema),
});

export const WorkoutPlanBasicSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  daysPerWeek: z.number(),
  isPublic: z.boolean(),
  isSystem: z.boolean(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WorkoutPlanSchema = WorkoutPlanBasicSchema.extend({
  days: z.array(PlanDaySchema),
});

export const UserPlanSchema = z.object({
  id: z.number(),
  userId: z.number(),
  planId: z.number(),
  isActive: z.boolean(),
  startedAt: z.string(),
  plan: WorkoutPlanBasicSchema,
});

export const SubscribeResponseSchema = z.object({
  userPlan: UserPlanSchema,
  requiredExercises: z.array(ExerciseSchema),
  missingTMs: z.array(ExerciseSchema),
});

export const PlanSetSchema = z.object({
  id: z.number(),
  planDayExerciseId: z.number(),
  setOrder: z.number(),
  percentage: z.coerce.number(),
  reps: z.number(),
  isAmrap: z.boolean(),
  isProgression: z.boolean(),
});

export const PlanDayExerciseWithSetsSchema = PlanDayExerciseSchema.extend({
  sets: z.array(PlanSetSchema),
});

export const PlanDayWithSetsSchema = PlanDaySchema.extend({
  exercises: z.array(PlanDayExerciseWithSetsSchema),
});

export const ProgressionRuleSchema = z.object({
  id: z.number().optional(),
  exerciseId: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
  minReps: z.number(),
  maxReps: z.number(),
  increase: z.coerce.number(),
  exercise: ExerciseSchema.optional(),
});

export const PlanWithDetailsSchema = WorkoutPlanSchema.extend({
  days: z.array(PlanDayWithSetsSchema),
  progressionRules: z.array(ProgressionRuleSchema),
});

export const AdminPlanListItemSchema = WorkoutPlanBasicSchema.extend({
  subscriberCount: z.number(),
});

// Progress schemas
export const ProgressExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  currentTM: z.number().nullable(),
  history: z.array(z.object({
    weight: z.number(),
    effectiveDate: z.string(),
  })),
});

export const ProgressResponseSchema = z.object({
  exercises: z.array(ProgressExerciseSchema),
  planSwitches: z.array(z.object({ date: z.string(), planName: z.string() })).optional().default([]),
});

export type ProgressExercise = z.infer<typeof ProgressExerciseSchema>;
export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;

// Infer TypeScript types from schemas
export type WorkoutSet = z.infer<typeof WorkoutSetSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type WorkoutHistoryItem = z.infer<typeof WorkoutHistoryItemSchema>;
export type CalendarWorkout = z.infer<typeof CalendarWorkoutSchema>;
export type ProgressionResult = z.infer<typeof ProgressionResultSchema>;
export type CompleteWorkoutResponse = z.infer<typeof CompleteWorkoutResponseSchema>;
export type WorkoutCalendarResponse = z.infer<typeof WorkoutCalendarResponseSchema>;
export type ScheduledDay = z.infer<typeof ScheduledDaySchema>;
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;
export type ScheduleResponse = z.infer<typeof ScheduleResponseSchema>;

export type User = z.infer<typeof UserSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type TrainingMax = z.infer<typeof TrainingMaxSchema>;
export type OneRepMaxes = z.infer<typeof OneRepMaxesSchema>;
export type SetupResponse = z.infer<typeof SetupResponseSchema>;

export type Exercise = z.infer<typeof ExerciseSchema>;
export type PlanDayExercise = z.infer<typeof PlanDayExerciseSchema>;
export type PlanDay = z.infer<typeof PlanDaySchema>;
export type WorkoutPlan = z.infer<typeof WorkoutPlanSchema>;
export type SubscribeResponse = z.infer<typeof SubscribeResponseSchema>;
export type PlanSet = z.infer<typeof PlanSetSchema>;
export type ProgressionRule = z.infer<typeof ProgressionRuleSchema>;
export type PlanWithDetails = z.infer<typeof PlanWithDetailsSchema>;
export type AdminPlanListItem = z.infer<typeof AdminPlanListItemSchema>;

// Social schemas
export const FriendSchema = z.object({
  id: z.number(),
  userId: z.number(),
  username: z.string(),
  streak: z.number().default(0),
});

export const FriendRequestSchema = z.object({
  id: z.number(),
  requesterId: z.number(),
  username: z.string(),
});

export const FriendsResponseSchema = z.object({
  friends: z.array(FriendSchema),
});

export const FriendRequestsResponseSchema = z.object({
  requests: z.array(FriendRequestSchema),
});

export const FeedEventPayloadSchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('workout_completed'),
    workoutId: z.number(),
    dayNumber: z.number(),
  }),
  z.object({
    eventType: z.literal('tm_increased'),
    exerciseSlug: z.string(),
    exerciseName: z.string(),
    newTM: z.number(),
    increase: z.number(),
  }),
  z.object({
    eventType: z.literal('streak_milestone'),
    days: z.number(),
  }),
  z.object({
    eventType: z.literal('badge_unlocked'),
    slug: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  z.object({
    eventType: z.literal('plan_switched'),
    planId: z.number(),
    planName: z.string(),
    planSlug: z.string(),
  }),
]);

export const FeedReactionSchema = z.object({
  emoji: z.string(),
  count: z.number(),
  reactedByMe: z.boolean(),
});

export const ReactResponseSchema = z.object({
  reacted: z.boolean(),
  count: z.number(),
});

export const FeedEventCommentSchema = z.object({
  id: z.number(),
  feedEventId: z.number(),
  userId: z.number(),
  username: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

export const CommentsResponseSchema = z.object({
  comments: z.array(FeedEventCommentSchema),
});

export const CreateCommentResponseSchema = z.object({
  id: z.number(),
  feedEventId: z.number(),
  userId: z.number(),
  text: z.string(),
  createdAt: z.string(),
});

export const FeedEventSchema = z.object({
  id: z.number(),
  userId: z.number(),
  username: z.string(),
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  reactions: z.array(FeedReactionSchema).default([]),
  streak: z.number().default(0),
  commentCount: z.number().default(0),
});

export const FeedResponseSchema = z.object({
  events: z.array(FeedEventSchema),
});

export const LeaderboardRankingSchema = z.object({
  userId: z.number(),
  username: z.string(),
  weight: z.number(),
});

export const LeaderboardExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  rankings: z.array(LeaderboardRankingSchema),
});

export const LeaderboardResponseSchema = z.object({
  exercises: z.array(LeaderboardExerciseSchema),
});

export const UserSearchResultSchema = z.object({
  id: z.number(),
  username: z.string(),
});

export const UserSearchResponseSchema = z.object({
  users: z.array(UserSearchResultSchema),
});

export type UserSearchResult = z.infer<typeof UserSearchResultSchema>;
export type UserSearchResponse = z.infer<typeof UserSearchResponseSchema>;

export type Friend = z.infer<typeof FriendSchema>;
export type FriendRequest = z.infer<typeof FriendRequestSchema>;
export type FeedEventPayload = z.infer<typeof FeedEventPayloadSchema>;
export type FeedEvent = z.infer<typeof FeedEventSchema>;
export type FeedReaction = z.infer<typeof FeedReactionSchema>;
export type ReactResponse = z.infer<typeof ReactResponseSchema>;
export type FeedEventComment = z.infer<typeof FeedEventCommentSchema>;
export type CommentsResponse = z.infer<typeof CommentsResponseSchema>;
export type CreateCommentResponse = z.infer<typeof CreateCommentResponseSchema>;
export type LeaderboardRanking = z.infer<typeof LeaderboardRankingSchema>;
export type LeaderboardExercise = z.infer<typeof LeaderboardExerciseSchema>;
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export type Achievement = z.infer<typeof AchievementSchema>;
export type AchievementsResponse = z.infer<typeof AchievementsResponseSchema>;

// Notification SSE schemas
export const notificationEventSchema = z.object({
  type: z.enum(['workout_completed', 'achievement_earned', 'friend_request_accepted', 'comment_received']),
  message: z.string(),
});

export type NotificationEvent = z.infer<typeof notificationEventSchema>;

// Push notification schemas
export const pushPublicKeySchema = z.object({
  publicKey: z.string(),
});

export const pushSubscribeResponseSchema = z.object({
  ok: z.boolean(),
});

export type PushPublicKey = z.infer<typeof pushPublicKeySchema>;
export type PushSubscribeResponse = z.infer<typeof pushSubscribeResponseSchema>;
