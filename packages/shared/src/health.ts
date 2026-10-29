import { z } from 'zod';

/** Contrat de la route `GET /api/v1/health`, partagé par l'API et l'app. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  /** `true` quand la requête de vérification sur Postgres a abouti. */
  database: z.boolean(),
  /** Date de la réponse, au format ISO 8601. */
  time: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
