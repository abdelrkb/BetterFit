import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@betterfit/shared';
import { buildApp, type App } from '../src/app.js';

let app: App;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/health', () => {
  it('répond une charge utile conforme au schéma partagé', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(() => healthResponseSchema.parse(response.json())).not.toThrow();
  });
});
