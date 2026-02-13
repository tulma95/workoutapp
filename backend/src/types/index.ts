import { Request } from 'express';

export type UnitPreference = 'kg' | 'lb';
export type WorkoutStatus = 'in_progress' | 'completed' | 'discarded';

export interface JwtPayload {
  userId: number;
  email: string;
  isAdmin: boolean;
}

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
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
