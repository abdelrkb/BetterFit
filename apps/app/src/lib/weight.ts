import {
  WEIGHT_HISTORY_DAYS,
  weightHistorySchema,
  type WeightEntryInput,
  type WeightHistory,
} from '@betterfit/shared';
import { useSession } from '../stores/session';

export function fetchWeightHistory(days = WEIGHT_HISTORY_DAYS): Promise<WeightHistory> {
  return useSession
    .getState()
    .authedRequest(`/me/weight?days=${days}`, {}, (data) => weightHistorySchema.parse(data));
}

export function saveWeight(input: WeightEntryInput): Promise<WeightHistory> {
  return useSession
    .getState()
    .authedRequest('/me/weight', { method: 'POST', body: input }, (data) =>
      weightHistorySchema.parse(data),
    );
}

export function deleteWeight(date: string): Promise<WeightHistory> {
  return useSession
    .getState()
    .authedRequest(`/me/weight/${date}`, { method: 'DELETE' }, (data) =>
      weightHistorySchema.parse(data),
    );
}
