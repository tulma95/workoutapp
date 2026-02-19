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
});

export const WorkoutHistoryItemSchema = z.object({
  id: z.number(),
  dayNumber: z.number(),
  status: z.enum(['in_progress', 'completed', 'discarded']),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const CalendarWorkoutSchema = z.object({
  id: z.number(),
  dayNumber: z.number(),
  status: z.enum(['in_progress', 'completed', 'discarded']),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const CompleteWorkoutResponseSchema = z.object({
  workout: WorkoutSchema,
  // Support both old (fallback) and new (plan-driven) formats
  progression: ProgressionResultSchema.nullable().optional(),
  progressions: z.array(ProgressionResultSchema).optional(),
});

export const WorkoutCalendarResponseSchema = z.object({
  workouts: z.array(CalendarWorkoutSchema),
});

// Auth schemas
export const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  displayName: z.string(),
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
