import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('accepte une réponse complète', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      service: 'betterfit-api',
      version: '0.0.0',
      database: true,
      time: '2026-01-01T00:00:00.000Z',
    });

    expect(parsed.database).toBe(true);
  });

  it('refuse une réponse sans l’état de la base', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'ok',
        service: 'betterfit-api',
        version: '0.0.0',
        time: '2026-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });
});
