import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { API_PREFIX, setZodMessagesToFrench } from '@betterfit/shared';
import Fastify from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { authPlugin } from './auth/plugin.js';
import { corsOrigins, env } from './env.js';
import { HttpError, sendError } from './errors.js';
import { ensureUploadsDir, UPLOADS_DIR } from './paths.js';
import { authRoutes } from './routes/auth.js';
import { coachingRoutes } from './routes/coaching.js';
import { exerciseRoutes } from './routes/exercises.js';
import { programRoutes } from './routes/programs.js';
import { workoutRoutes } from './routes/workouts.js';
import { foodRoutes } from './routes/foods.js';
import { healthRoutes } from './routes/health.js';
import { journalRoutes } from './routes/journal.js';
import { meRoutes } from './routes/me.js';
import { nutritionRoutes } from './routes/nutrition.js';
import { recipeRoutes } from './routes/recipes.js';
import { weightRoutes } from './routes/weight.js';

export async function buildApp() {
  // Les erreurs de validation renvoyées par champ sont affichées telles
  // quelles par l'app : elles doivent être en français.
  setZodMessagesToFrench();

  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : { transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return sendError(reply, error);
    }

    // Erreur de validation zod : on la renvoie champ par champ, pour que le
    // formulaire puisse souligner la bonne ligne.
    if (hasZodFastifySchemaValidationErrors(error)) {
      const fields: Record<string, string> = {};

      for (const issue of error.validation) {
        // `instancePath` vaut « /password », « /profile/heightCm »… On en fait
        // un nom de champ que le formulaire sait retrouver.
        const field = issue.instancePath.replace(/^\//, '').replace(/\//g, '.');
        fields[field.length > 0 ? field : 'body'] = issue.message ?? 'Valeur invalide.';
      }

      return sendError(
        reply,
        new HttpError(400, 'validation/failed', 'Données invalides.', fields),
      );
    }

    // Erreurs levées par Fastify lui-même : corps JSON vide ou illisible,
    // charge utile trop grosse… Ce sont des fautes de l'appelant, pas des
    // pannes du serveur : les annoncer en 500 masquerait la vraie cause.
    const statusCode = (error as { statusCode?: unknown }).statusCode;

    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      request.log.info({ err: error }, 'requête mal formée');

      return sendError(
        reply,
        new HttpError(statusCode, 'request/malformed', 'Requête mal formée.'),
      );
    }

    request.log.error({ err: error }, 'erreur non gérée');

    // Rien d'autre ne sort : un message interne pourrait renseigner un attaquant.
    return sendError(reply, new HttpError(500, 'server/error', 'Erreur interne.'));
  });

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    // `@fastify/cors` n'autorise par défaut que GET, HEAD et POST : sans cette
    // liste, toute modification depuis un navigateur (PUT, PATCH, DELETE) est
    // refusée au vol plané du préflight.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(cookie);
  await app.register(authPlugin);

  // Photos des exercices. Publiques : ce sont des images du domaine public,
  // et les protéger obligerait à passer un jeton dans chaque balise <img>.
  ensureUploadsDir();
  await app.register(fastifyStatic, {
    root: `${UPLOADS_DIR}/exercises`,
    prefix: `${API_PREFIX}/exercises/images/`,
    decorateReply: false,
    // Les photos ne changent jamais : on laisse les navigateurs les garder.
    maxAge: '30d',
    immutable: true,
  });

  await app.register(healthRoutes, { prefix: API_PREFIX });
  await app.register(authRoutes, { prefix: API_PREFIX });
  await app.register(meRoutes, { prefix: API_PREFIX });
  await app.register(exerciseRoutes, { prefix: API_PREFIX });
  await app.register(programRoutes, { prefix: API_PREFIX });
  await app.register(workoutRoutes, { prefix: API_PREFIX });
  await app.register(coachingRoutes, { prefix: API_PREFIX });
  await app.register(weightRoutes, { prefix: API_PREFIX });
  await app.register(nutritionRoutes, { prefix: API_PREFIX });
  await app.register(recipeRoutes, { prefix: API_PREFIX });
  await app.register(foodRoutes, { prefix: API_PREFIX });
  await app.register(journalRoutes, { prefix: API_PREFIX });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
