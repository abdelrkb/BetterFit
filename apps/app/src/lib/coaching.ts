import {
  clientDetailSchema,
  clientListSchema,
  coachSettingsSchema,
  invitationListSchema,
  invitationSchema,
  myCoachingSchema,
  type ClientDetail,
  type ClientSummary,
  type CoachSettings,
  type Invitation,
  type InvitationInput,
  type MyCoaching,
} from '@betterfit/shared';
import { useSession } from '../stores/session';

const api = () => useSession.getState();

export function fetchMyCoaching(): Promise<MyCoaching> {
  return api().authedRequest('/me/coaching', {}, (data) => myCoachingSchema.parse(data));
}

export function acceptProposal(relationId: string): Promise<void> {
  return api().authedRequest(`/me/coaching/${relationId}/accept`, { method: 'POST' });
}

export function declineProposal(relationId: string): Promise<void> {
  return api().authedRequest(`/me/coaching/${relationId}/decline`, { method: 'POST' });
}

export function endCoaching(relationId: string): Promise<void> {
  return api().authedRequest(`/me/coaching/${relationId}/end`, { method: 'POST' });
}

export function joinWithCode(code: string): Promise<void> {
  return api().authedRequest('/me/coaching/join', { method: 'POST', body: { code } });
}

export function activateCoach(settings: CoachSettings): Promise<CoachSettings> {
  return api().authedRequest('/coach/activate', { method: 'POST', body: settings }, (data) =>
    coachSettingsSchema.parse(data),
  );
}

export function fetchCoachSettings(): Promise<CoachSettings> {
  return api().authedRequest('/coach/settings', {}, (data) => coachSettingsSchema.parse(data));
}

export function listClients(): Promise<{ items: ClientSummary[] }> {
  return api().authedRequest('/coach/clients', {}, (data) => clientListSchema.parse(data));
}

export function fetchClient(id: string): Promise<ClientDetail> {
  return api().authedRequest(`/coach/clients/${id}`, {}, (data) => clientDetailSchema.parse(data));
}

export function listInvitations(): Promise<{ items: Invitation[] }> {
  return api().authedRequest('/coach/invitations', {}, (data) => invitationListSchema.parse(data));
}

export function createInvitation(input: InvitationInput): Promise<Invitation> {
  return api().authedRequest('/coach/invitations', { method: 'POST', body: input }, (data) =>
    invitationSchema.parse(data),
  );
}

export function cancelInvitation(id: string): Promise<void> {
  return api().authedRequest(`/coach/invitations/${id}`, { method: 'DELETE' });
}

export function assignProgram(clientId: string, programId: string, title?: string): Promise<void> {
  return api().authedRequest(`/coach/clients/${clientId}/programs`, {
    method: 'POST',
    body: title ? { programId, title } : { programId },
  });
}
