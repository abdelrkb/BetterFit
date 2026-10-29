import { createHash, randomBytes } from 'node:crypto';
import {
  AUTH_ERROR_CODES,
  apiErrorSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sessionSchema,
} from '@betterfit/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { checkRateLimit, clearFailures, recordFailure } from '../auth/rate-limit.js';
import { hashPassword, verifyPassword, wastePasswordTime } from '../auth/password.js';
import {
  buildSession,
  clearRefreshCookie,
  isNativeClient,
  readRefreshToken,
  setRefreshCookie,
} from '../auth/session.js';
import {
  issueRefreshToken,
  revokeAllSessions,
  revokeSession,
  rotateRefreshToken,
} from '../auth/tokens.js';
import { db } from '../db/client.js';
import { passwordResetTokens, users } from '../db/schema.js';
import { env } from '../env.js';
import { badRequest, conflict, tooManyRequests, unauthorized } from '../errors.js';
import { sendMail } from '../mail/mailer.js';

/** Durée de validité d'un lien de réinitialisation. Court : c'est un lien sensible. */
const RESET_TOKEN_TTL_MINUTES = 60;

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/register',
    {
      schema: {
        body: registerSchema,
        response: { 201: sessionSchema, 409: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { email, password, name, healthDataConsent } = request.body;

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      if (existing) {
        throw conflict(AUTH_ERROR_CODES.emailTaken, 'Adresse déjà utilisée.', {
          email: AUTH_ERROR_CODES.emailTaken,
        });
      }

      const [user] = await db
        .insert(users)
        .values({
          email,
          name,
          passwordHash: await hashPassword(password),
          healthDataConsentAt: healthDataConsent ? new Date() : null,
        })
        .returning();

      if (!user) throw badRequest('auth/register-failed', 'Création du compte impossible.');

      const refresh = await issueRefreshToken(user.id, {
        userAgent: request.headers['user-agent'],
      });

      return reply.status(201).send(await buildSession(request, reply, user, refresh));
    },
  );

  app.post(
    '/auth/login',
    {
      schema: {
        body: loginSchema,
        response: { 200: sessionSchema, 401: apiErrorSchema, 429: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      const limit = await checkRateLimit(`login:${email}`);
      if (limit.blocked) {
        throw tooManyRequests(
          AUTH_ERROR_CODES.tooManyAttempts,
          'Trop de tentatives.',
          limit.retryAfterSeconds,
        );
      }

      const [user] = await db.select().from(users).where(eq(users.email, email));

      // Même traitement qu'un mot de passe faux : on ne révèle pas si le compte existe.
      if (!user?.passwordHash) {
        await wastePasswordTime(password);
        await recordFailure(`login:${email}`);
        throw unauthorized(AUTH_ERROR_CODES.invalidCredentials, 'Identifiants incorrects.');
      }

      if (!(await verifyPassword(user.passwordHash, password))) {
        await recordFailure(`login:${email}`);
        throw unauthorized(AUTH_ERROR_CODES.invalidCredentials, 'Identifiants incorrects.');
      }

      await clearFailures(`login:${email}`);

      const refresh = await issueRefreshToken(user.id, {
        userAgent: request.headers['user-agent'],
      });

      return buildSession(request, reply, user, refresh);
    },
  );

  app.post(
    '/auth/refresh',
    {
      schema: {
        body: z.object({ refreshToken: z.string().optional() }).nullish(),
        response: { 200: sessionSchema, 401: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const token = readRefreshToken(request, request.body);
      if (!token) {
        throw unauthorized(AUTH_ERROR_CODES.invalidToken, 'Jeton de rafraîchissement absent.');
      }

      const outcome = await rotateRefreshToken(token, request.headers['user-agent']);

      if (outcome.status !== 'ok') {
        clearRefreshCookie(reply);
        throw unauthorized(
          AUTH_ERROR_CODES.invalidToken,
          outcome.status === 'reused'
            ? 'Jeton déjà utilisé : la session a été fermée.'
            : 'Jeton de rafraîchissement invalide.',
        );
      }

      const [user] = await db.select().from(users).where(eq(users.id, outcome.userId));
      if (!user) {
        clearRefreshCookie(reply);
        throw unauthorized(AUTH_ERROR_CODES.invalidToken, 'Compte introuvable.');
      }

      return buildSession(request, reply, user, outcome.refresh);
    },
  );

  app.post(
    '/auth/logout',
    {
      schema: {
        body: z.object({ refreshToken: z.string().optional() }).nullish(),
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const token = readRefreshToken(request, request.body);

      if (token) {
        // La rotation révoque la lignée ; on referme aussi la session neuve.
        const outcome = await rotateRefreshToken(token);
        if (outcome.status === 'ok') await revokeSession(outcome.refresh.sessionId);
      }

      clearRefreshCookie(reply);

      return reply.status(204).send(null);
    },
  );

  app.post(
    '/auth/forgot-password',
    {
      schema: {
        body: forgotPasswordSchema,
        response: { 202: z.object({ sent: z.literal(true) }), 429: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { email } = request.body;

      const limit = await checkRateLimit(`forgot:${email}`);
      if (limit.blocked) {
        throw tooManyRequests(
          AUTH_ERROR_CODES.tooManyAttempts,
          'Trop de demandes.',
          limit.retryAfterSeconds,
        );
      }
      await recordFailure(`forgot:${email}`);

      const [user] = await db.select().from(users).where(eq(users.email, email));

      // Réponse identique que le compte existe ou non : sinon la route
      // deviendrait un moyen de savoir qui est inscrit.
      if (user) {
        const token = randomBytes(32).toString('base64url');

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash: hashResetToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
        });

        const link = `${env.APP_URL}/reset-password?token=${token}`;

        await sendMail({
          to: user.email,
          subject: 'BetterFit — réinitialiser ton mot de passe',
          text: [
            `Salut ${user.name},`,
            '',
            'Tu as demandé à changer ton mot de passe. Ouvre ce lien :',
            link,
            '',
            `Le lien est valable ${RESET_TOKEN_TTL_MINUTES} minutes.`,
            "Si tu n'as rien demandé, ignore ce message : rien n'a changé.",
          ].join('\n'),
        });
      }

      return reply.status(202).send({ sent: true as const });
    },
  );

  app.post(
    '/auth/reset-password',
    {
      schema: {
        body: resetPasswordSchema,
        response: { 200: sessionSchema, 400: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const { token, password } = request.body;

      const [row] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.tokenHash, hashResetToken(token)),
            isNull(passwordResetTokens.usedAt),
          ),
        );

      if (!row || row.expiresAt.getTime() <= Date.now()) {
        throw badRequest(AUTH_ERROR_CODES.invalidToken, 'Lien invalide ou expiré.');
      }

      const [user] = await db
        .update(users)
        .set({ passwordHash: await hashPassword(password), updatedAt: new Date() })
        .where(eq(users.id, row.userId))
        .returning();

      if (!user) throw badRequest(AUTH_ERROR_CODES.invalidToken, 'Compte introuvable.');

      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, row.id));

      // Changer de mot de passe déconnecte partout : c'est le geste attendu
      // quand on soupçonne que quelqu'un d'autre avait accès au compte.
      await revokeAllSessions(user.id);
      await clearFailures(`login:${user.email}`);

      const refresh = await issueRefreshToken(user.id, {
        userAgent: request.headers['user-agent'],
      });

      if (!isNativeClient(request)) setRefreshCookie(reply, refresh);

      return buildSession(request, reply, user, refresh);
    },
  );
};
