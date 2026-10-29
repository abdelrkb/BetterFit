import {
  exerciseListSchema,
  exerciseSchema,
  type CustomExerciseInput,
  type Exercise,
  type ExerciseList,
  type ExerciseSearch,
  type ExerciseTranslationInput,
} from '@betterfit/shared';
import { useSession } from '../stores/session';
import { apiBaseUrl } from './api';

/** Les photos sont servies par l'API : on préfixe les chemins relatifs. */
export function imageUrl(path: string): string {
  return path.startsWith('http') ? path : `${apiBaseUrl}${path}`;
}

function toQueryString(search: Partial<ExerciseSearch>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}

export function searchExercises(search: Partial<ExerciseSearch>): Promise<ExerciseList> {
  return useSession
    .getState()
    .authedRequest(`/exercises${toQueryString(search)}`, {}, (data) =>
      exerciseListSchema.parse(data),
    );
}

export function fetchExercise(id: string): Promise<Exercise> {
  return useSession
    .getState()
    .authedRequest(`/exercises/${id}`, {}, (data) => exerciseSchema.parse(data));
}

export function createExercise(input: CustomExerciseInput): Promise<Exercise> {
  return useSession
    .getState()
    .authedRequest('/exercises', { method: 'POST', body: input }, (data) =>
      exerciseSchema.parse(data),
    );
}

export function updateExercise(id: string, input: Partial<CustomExerciseInput>): Promise<Exercise> {
  return useSession
    .getState()
    .authedRequest(`/exercises/${id}`, { method: 'PATCH', body: input }, (data) =>
      exerciseSchema.parse(data),
    );
}

export function deleteExercise(id: string): Promise<void> {
  return useSession.getState().authedRequest(`/exercises/${id}`, { method: 'DELETE' });
}

export function saveTranslation(id: string, input: ExerciseTranslationInput): Promise<Exercise> {
  return useSession
    .getState()
    .authedRequest(`/exercises/${id}/translation`, { method: 'PUT', body: input }, (data) =>
      exerciseSchema.parse(data),
    );
}
