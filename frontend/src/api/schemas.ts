import { z } from 'zod';

// Workout schemas
export const WorkoutSetSchema = z.object({
  id: z.number(),
  workoutId: z.number(),
  exercise: z.string(),
  tier: z.string(),
  setOrder: z.number(),
  prescribedWeight: z.number(),
  prescribedReps: z.number(),
  isAmrap: z.boolean(),
  actualReps: z.number().nullable(),
  completed: z.boolean(),
  createdAt: z.string(),
});

export const WorkoutSchema = z.object({
  id: z.number(),
  userId: z.number(),
  dayNumber: z.number(),
  status: z.enum(['in_progress', 'completed', 'discarded']),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  sets: z.array(WorkoutSetSchema),
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

export const ProgressionResultSchema = z.object({
  exercise: z.string(),
  previousTM: z.number(),
  newTM: z.number(),
  increase: z.number(),
});

export const CompleteWorkoutResponseSchema = z.object({
  workout: WorkoutSchema,
  progression: ProgressionResultSchema.nullable(),
});

export const WorkoutCalendarResponseSchema = z.object({
  workouts: z.array(CalendarWorkoutSchema),
});

// Auth schemas
export const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  displayName: z.string(),
  unitPreference: z.enum(['kg', 'lb']),
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
export const TrainingMaxHistorySchema = z.array(TrainingMaxSchema);

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
export type TrainingMaxHistory = z.infer<typeof TrainingMaxHistorySchema>;
