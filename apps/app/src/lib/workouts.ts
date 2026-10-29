import {
  progressSchema,
  workoutListSchema,
  workoutSchema,
  type Progress,
  type Workout,
  type WorkoutList,
} from '@betterfit/shared';
import { useSession } from '../stores/session';

export function listWorkouts(): Promise<WorkoutList> {
  return useSession
    .getState()
    .authedRequest('/workouts', {}, (data) => workoutListSchema.parse(data));
}

export function fetchWorkout(id: string): Promise<Workout> {
  return useSession
    .getState()
    .authedRequest(`/workouts/${id}`, {}, (data) => workoutSchema.parse(data));
}

export function deleteWorkout(id: string): Promise<void> {
  return useSession.getState().authedRequest(`/workouts/${id}`, { method: 'DELETE' });
}

export function fetchProgress(exerciseId: string): Promise<Progress> {
  return useSession
    .getState()
    .authedRequest(`/exercises/${exerciseId}/progress`, {}, (data) => progressSchema.parse(data));
}
