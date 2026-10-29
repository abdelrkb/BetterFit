import {
  programListSchema,
  programSchema,
  type Program,
  type ProgramInput,
  type ProgramList,
} from '@betterfit/shared';
import { useSession } from '../stores/session';

export function listPrograms(options: { templates?: boolean } = {}): Promise<ProgramList> {
  const query = options.templates === undefined ? '' : `?templates=${options.templates}`;

  return useSession
    .getState()
    .authedRequest(`/programs${query}`, {}, (data) => programListSchema.parse(data));
}

export function fetchProgram(id: string): Promise<Program> {
  return useSession
    .getState()
    .authedRequest(`/programs/${id}`, {}, (data) => programSchema.parse(data));
}

export function createProgram(input: ProgramInput): Promise<Program> {
  return useSession
    .getState()
    .authedRequest('/programs', { method: 'POST', body: input }, (data) =>
      programSchema.parse(data),
    );
}

export function saveProgram(id: string, input: ProgramInput): Promise<Program> {
  return useSession
    .getState()
    .authedRequest(`/programs/${id}`, { method: 'PUT', body: input }, (data) =>
      programSchema.parse(data),
    );
}

export function deleteProgram(id: string): Promise<void> {
  return useSession.getState().authedRequest(`/programs/${id}`, { method: 'DELETE' });
}

export function duplicateProgram(id: string, title?: string): Promise<Program> {
  return useSession
    .getState()
    .authedRequest(
      `/programs/${id}/duplicate`,
      { method: 'POST', body: title ? { title } : {} },
      (data) => programSchema.parse(data),
    );
}
