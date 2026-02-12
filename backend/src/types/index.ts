import { Request } from 'express';

export type UnitPreference = 'kg' | 'lb';
export type WorkoutStatus = 'in_progress' | 'completed' | 'discarded';
export type Exercise = 'bench' | 'squat' | 'ohp' | 'deadlift';

export interface JwtPayload {
  userId: number;
  email: string;
}

export interface AuthRequest extends Request {
  userId?: number;
}

export class ExistingWorkoutError extends Error {
  constructor(
    public workoutId: number,
    public dayNumber: number
  ) {
    super('EXISTING_WORKOUT');
    this.name = 'ExistingWorkoutError';
  }
}
