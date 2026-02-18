import { Request } from 'express';

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

/**
 * Extract userId from an authenticated request.
 * Use in route handlers behind the authenticate middleware.
 */
export function getUserId(req: AuthRequest): number {
  if (req.userId == null) {
    throw new Error('userId missing from authenticated request');
  }
  return req.userId;
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
