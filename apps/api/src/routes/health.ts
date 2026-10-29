import { healthResponseSchema } from '@betterfit/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { sql } from '../db/client.js';

const SERVICE_NAME = 'betterfit-api';
const SERVICE_VERSION = '0.0.0';

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        response: { 200: healthResponseSchema },
      },
    },
    async () => {
      let database = false;

      try {
        await sql`select 1`;
        database = true;
      } catch (error) {
        app.log.warn({ err: error }, 'base de données injoignable');
      }

      return {
        status: 'ok' as const,
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        database,
        time: new Date().toISOString(),
      };
    },
  );
};
