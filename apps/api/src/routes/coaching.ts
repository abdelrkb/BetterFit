import { createHash, randomBytes } from 'node:crypto';
import {
  CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
  INVITATION_DAYS,
  acceptCodeSchema,
  apiErrorSchema,
  assignProgramSchema,
  clientDetailSchema,
  clientListSchema,
  coachSettingsSchema,
  invitationInputSchema,
  invitationListSchema,
  invitationSchema,
  myCoachingSchema,
  weightTrend,
  type ProgramInput,
} from '@betterfit/shared';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { activeCoachOf, assertActiveClient, assertIsCoach } from '../coaching/access.js';
import { db } from '../db/client.js';
import {
  coachSettings,
  coachingRelations,
  invitations,
  programs,
  sessions,
  users,
  weeklySchedule,
  weightEntries,
  workoutLogs,
} from '../db/schema.js';
import { env } from '../env.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { sendMail } from '../mail/mailer.js';
import { loadProgram, writeContents } from './programs.js';

/** Code court, sans caractères qu'on confond en le dictant. */
function generateCode(): string {
  const bytes = randomBytes(INVITATION_CODE_LENGTH);

  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function expiry(): Date {
  return new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);
}

/** Vingt-huit jours en arrière : la fenêtre d'activité d'un client. */
function fourWeeksAgo(): Date {
  return new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
}

/**
 * Accepte une invitation : la relation passe en actif.
 *
 * Refuse si le client a déjà un coach actif — un seul coach en V1 — et si
 * quelqu'un essaie de devenir son propre client.
 */
async function acceptRelation(
  invitationId: string,
  coachId: string,
  clientId: string,
): Promise<void> {
  if (coachId === clientId) {
    throw badRequest('coach/self', 'On ne peut pas être son propre coach.');
  }

  const existing = await activeCoachOf(clientId);

  if (existing && existing.coachId !== coachId) {
    throw conflict(
      'coach/already-coached',
      'Ce compte a déjà un coach. Il faut d’abord mettre fin au coaching en cours.',
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(coachingRelations)
      .values({ coachId, clientId, status: 'active', acceptedAt: new Date() })
      .onConflictDoUpdate({
        target: [coachingRelations.coachId, coachingRelations.clientId],
        set: { status: 'active', acceptedAt: new Date(), endedAt: null },
      });

    await tx
      .update(invitations)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(invitations.id, invitationId));
  });
}

export const coachingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.requireAuth);

  // ---------------------------------------------------------------- Espace coach

  app.post(
    '/coach/activate',
    { schema: { body: coachSettingsSchema, response: { 200: coachSettingsSchema } } },
    async (request) => {
      const user = currentUser(request);

      const [saved] = await db
        .insert(coachSettings)
        .values({ userId: user.id, ...request.body })
        .onConflictDoUpdate({
          target: coachSettings.userId,
          set: { ...request.body, updatedAt: new Date() },
        })
        .returning();

      if (!saved) throw badRequest('coach/activate-failed', 'Activation impossible.');

      return {
        displayName: saved.displayName,
        contact: saved.contact,
        accentColor: saved.accentColor as never,
      };
    },
  );

  app.get(
    '/coach/settings',
    { schema: { response: { 200: coachSettingsSchema, 403: apiErrorSchema } } },
    async (request) => {
      const user = currentUser(request);
      await assertIsCoach(user.id);

      const [settings] = await db
        .select()
        .from(coachSettings)
        .where(eq(coachSettings.userId, user.id));

      if (!settings) throw notFound('coach/not-activated', 'Espace coach introuvable.');

      return {
        displayName: settings.displayName,
        contact: settings.contact,
        accentColor: settings.accentColor as never,
      };
    },
  );

  // ---------------------------------------------------------------- Invitations

  app.post(
    '/coach/invitations',
    {
      schema: {
        body: invitationInputSchema,
        response: { 201: invitationSchema, 403: apiErrorSchema, 409: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = currentUser(request);
      await assertIsCoach(user.id);

      const input = request.body;
      const [settings] = await db
        .select()
        .from(coachSettings)
        .where(eq(coachSettings.userId, user.id));

      let email: string | null = null;
      let targetUserId: string | null = null;
      let code: string | null = null;
      let tokenHash: string | null = null;
      let targetName: string | null = null;
      let plainToken: string | null = null;

      if (input.kind === 'code') {
        code = generateCode();
      } else {
        email = input.email;

        const [target] = await db.select().from(users).where(eq(users.email, input.email));

        if (input.kind === 'in_app') {
          // Invitation dans l'app : la personne doit déjà avoir un compte.
          if (!target) {
            throw notFound(
              'coach/user-not-found',
              'Aucun compte avec cette adresse. Invite par e-mail à la place.',
            );
          }

          if (target.id === user.id) {
            throw badRequest('coach/self', 'On ne peut pas être son propre coach.');
          }

          targetUserId = target.id;
          targetName = target.name;

          // La proposition apparaît chez la personne : on crée la relation en
          // attente tout de suite.
          await db
            .insert(coachingRelations)
            .values({ coachId: user.id, clientId: target.id, status: 'pending' })
            .onConflictDoUpdate({
              target: [coachingRelations.coachId, coachingRelations.clientId],
              set: { status: 'pending', invitedAt: new Date(), endedAt: null },
            });
        } else {
          // Invitation par e-mail : la personne n'a pas forcément de compte.
          targetUserId = target?.id ?? null;
          targetName = target?.name ?? null;

          // Le jeton reste en clair le temps de l'envoi ; seule son empreinte
          // est stockée, comme pour un mot de passe.
          plainToken = randomBytes(32).toString('base64url');
          tokenHash = hashToken(plainToken);
        }
      }

      const [created] = await db
        .insert(invitations)
        .values({
          coachId: user.id,
          kind: input.kind,
          email,
          targetUserId,
          code,
          tokenHash,
          expiresAt: expiry(),
        })
        .returning();

      if (!created) throw badRequest('coach/invite-failed', 'Invitation impossible.');

      if (input.kind === 'email' && plainToken) {
        const link = `${env.APP_URL}/invitation?token=${plainToken}`;

        await sendMail({
          to: input.email,
          subject: `BetterFit — ${settings?.displayName ?? 'ton coach'} t’invite`,
          text: [
            'Bonjour,',
            '',
            `${settings?.displayName ?? 'Ton coach'} t’invite à le rejoindre sur BetterFit.`,
            '',
            'Ouvre ce lien pour accepter :',
            link,
            '',
            `Le lien est valable ${INVITATION_DAYS} jours.`,
            "Si tu n'attendais pas cette invitation, ignore ce message.",
          ].join('\n'),
        });
      }

      return reply.status(201).send({
        id: created.id,
        kind: created.kind,
        email: created.email,
        code: created.code,
        status: created.status,
        expiresAt: created.expiresAt.toISOString(),
        createdAt: created.createdAt.toISOString(),
        targetName,
      });
    },
  );

  app.get(
    '/coach/invitations',
    { schema: { response: { 200: invitationListSchema } } },
    async (request) => {
      const user = currentUser(request);
      await assertIsCoach(user.id);

      const rows = await db
        .select({ invitation: invitations, targetName: users.name })
        .from(invitations)
        .leftJoin(users, eq(users.id, invitations.targetUserId))
        .where(eq(invitations.coachId, user.id))
        .orderBy(desc(invitations.createdAt));

      const now = new Date();

      return {
        items: rows.map(({ invitation, targetName }) => ({
          id: invitation.id,
          kind: invitation.kind,
          email: invitation.email,
          code: invitation.code,
          // Une invitation périmée est annoncée comme telle sans qu'on ait
          // besoin d'une tâche de ménage.
          status:
            invitation.status === 'pending' && invitation.expiresAt < now
              ? ('expired' as const)
              : invitation.status,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
          targetName,
        })),
      };
    },
  );

  app.delete(
    '/coach/invitations/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      const [invitation] = await db
        .select()
        .from(invitations)
        .where(and(eq(invitations.id, request.params.id), eq(invitations.coachId, user.id)));

      if (!invitation) throw notFound('coach/invitation-not-found', 'Invitation introuvable.');

      await db.transaction(async (tx) => {
        await tx
          .update(invitations)
          .set({ status: 'cancelled' })
          .where(eq(invitations.id, invitation.id));

        // Une proposition retirée disparaît aussi de chez la personne visée.
        if (invitation.targetUserId) {
          await tx
            .update(coachingRelations)
            .set({ status: 'ended', endedAt: new Date() })
            .where(
              and(
                eq(coachingRelations.coachId, user.id),
                eq(coachingRelations.clientId, invitation.targetUserId),
                eq(coachingRelations.status, 'pending'),
              ),
            );
        }
      });

      return reply.status(204).send(null);
    },
  );

  // ---------------------------------------------------------------- Côté client

  app.get('/me/coaching', { schema: { response: { 200: myCoachingSchema } } }, async (request) => {
    const user = currentUser(request);

    const rows = await db
      .select({ relation: coachingRelations, settings: coachSettings, coachName: users.name })
      .from(coachingRelations)
      .innerJoin(users, eq(users.id, coachingRelations.coachId))
      .leftJoin(coachSettings, eq(coachSettings.userId, coachingRelations.coachId))
      .where(
        and(
          eq(coachingRelations.clientId, user.id),
          inArray(coachingRelations.status, ['active', 'pending']),
        ),
      );

    const active = rows.find((row) => row.relation.status === 'active');

    const [mySettings] = await db
      .select({ userId: coachSettings.userId })
      .from(coachSettings)
      .where(eq(coachSettings.userId, user.id));

    return {
      coach: active
        ? {
            relationId: active.relation.id,
            userId: active.relation.coachId,
            displayName: active.settings?.displayName ?? active.coachName,
            contact: active.settings?.contact ?? '',
            since: (active.relation.acceptedAt ?? active.relation.invitedAt).toISOString(),
          }
        : null,
      pending: rows
        .filter((row) => row.relation.status === 'pending')
        .map((row) => ({
          relationId: row.relation.id,
          coachId: row.relation.coachId,
          coachName: row.settings?.displayName ?? row.coachName,
          contact: row.settings?.contact ?? '',
          invitedAt: row.relation.invitedAt.toISOString(),
        })),
      isCoach: mySettings !== undefined,
    };
  });

  /** Accepter une proposition reçue dans l'app. */
  app.post(
    '/me/coaching/:relationId/accept',
    {
      schema: {
        params: z.object({ relationId: z.uuid() }),
        response: { 204: z.null(), 409: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = currentUser(request);

      const [relation] = await db
        .select()
        .from(coachingRelations)
        .where(
          and(
            eq(coachingRelations.id, request.params.relationId),
            eq(coachingRelations.clientId, user.id),
            eq(coachingRelations.status, 'pending'),
          ),
        );

      if (!relation) throw notFound('coach/invitation-not-found', 'Proposition introuvable.');

      const [invitation] = await db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.coachId, relation.coachId),
            eq(invitations.targetUserId, user.id),
            eq(invitations.status, 'pending'),
          ),
        );

      await acceptRelation(
        invitation?.id ?? '00000000-0000-0000-0000-000000000000',
        relation.coachId,
        user.id,
      );

      return reply.status(204).send(null);
    },
  );

  app.post(
    '/me/coaching/:relationId/decline',
    { schema: { params: z.object({ relationId: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      const [relation] = await db
        .select()
        .from(coachingRelations)
        .where(
          and(
            eq(coachingRelations.id, request.params.relationId),
            eq(coachingRelations.clientId, user.id),
            eq(coachingRelations.status, 'pending'),
          ),
        );

      if (!relation) throw notFound('coach/invitation-not-found', 'Proposition introuvable.');

      await db.transaction(async (tx) => {
        await tx
          .update(coachingRelations)
          .set({ status: 'ended', endedAt: new Date() })
          .where(eq(coachingRelations.id, relation.id));

        await tx
          .update(invitations)
          .set({ status: 'declined' })
          .where(
            and(
              eq(invitations.coachId, relation.coachId),
              eq(invitations.targetUserId, user.id),
              eq(invitations.status, 'pending'),
            ),
          );
      });

      return reply.status(204).send(null);
    },
  );

  /**
   * Rejoindre un coach depuis le lien reçu par e-mail.
   *
   * Le jeton n'est jamais stocké en clair : on compare son empreinte, comme
   * pour un mot de passe oublié.
   */
  app.post(
    '/me/coaching/join-token',
    {
      schema: {
        body: z.object({ token: z.string().min(16).max(200) }),
        response: { 204: z.null(), 404: apiErrorSchema, 409: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = currentUser(request);

      const [invitation] = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.tokenHash, hashToken(request.body.token)),
            eq(invitations.status, 'pending'),
          ),
        );

      if (!invitation || invitation.expiresAt < new Date()) {
        throw notFound('coach/invitation-not-found', 'Ce lien n’est plus valable.');
      }

      await acceptRelation(invitation.id, invitation.coachId, user.id);

      return reply.status(204).send(null);
    },
  );

  /** Rejoindre un coach avec le code qu'il a dicté. */
  app.post(
    '/me/coaching/join',
    {
      schema: {
        body: acceptCodeSchema,
        response: { 204: z.null(), 404: apiErrorSchema, 409: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = currentUser(request);

      const [invitation] = await db
        .select()
        .from(invitations)
        .where(and(eq(invitations.code, request.body.code), eq(invitations.status, 'pending')));

      if (!invitation || invitation.expiresAt < new Date()) {
        throw notFound('coach/invitation-not-found', 'Ce code n’est pas valable, ou il a expiré.');
      }

      await acceptRelation(invitation.id, invitation.coachId, user.id);

      return reply.status(204).send(null);
    },
  );

  /**
   * Mettre fin au coaching.
   *
   * Les deux côtés peuvent le faire. Le coach perd l'accès au suivi, mais les
   * programmes déjà reçus **restent au client** : on lui en transfère la
   * propriété, pour qu'il les garde même si le coach supprime les siens.
   */
  app.post(
    '/me/coaching/:relationId/end',
    { schema: { params: z.object({ relationId: z.uuid() }), response: { 204: z.null() } } },
    async (request, reply) => {
      const user = currentUser(request);

      const [relation] = await db
        .select()
        .from(coachingRelations)
        .where(
          and(
            eq(coachingRelations.id, request.params.relationId),
            or(eq(coachingRelations.clientId, user.id), eq(coachingRelations.coachId, user.id)),
            eq(coachingRelations.status, 'active'),
          ),
        );

      if (!relation) throw notFound('coach/relation-not-found', 'Relation introuvable.');

      await db.transaction(async (tx) => {
        await tx
          .update(coachingRelations)
          .set({ status: 'ended', endedAt: new Date() })
          .where(eq(coachingRelations.id, relation.id));

        await tx
          .update(programs)
          .set({ ownerId: relation.clientId, assignedToUserId: null, updatedAt: new Date() })
          .where(
            and(
              eq(programs.ownerId, relation.coachId),
              eq(programs.assignedToUserId, relation.clientId),
            ),
          );
      });

      return reply.status(204).send(null);
    },
  );

  // ---------------------------------------------------------------- Clients

  app.get(
    '/coach/clients',
    { schema: { response: { 200: clientListSchema } } },
    async (request) => {
      const user = currentUser(request);
      await assertIsCoach(user.id);

      const rows = await db
        .select({ relation: coachingRelations, user: users })
        .from(coachingRelations)
        .innerJoin(users, eq(users.id, coachingRelations.clientId))
        .where(and(eq(coachingRelations.coachId, user.id), eq(coachingRelations.status, 'active')))
        .orderBy(users.name);

      const clientIds = rows.map((row) => row.user.id);
      if (clientIds.length === 0) return { items: [] };

      const workouts = await db
        .select({ userId: workoutLogs.userId, finishedAt: workoutLogs.finishedAt })
        .from(workoutLogs)
        .where(inArray(workoutLogs.userId, clientIds));

      const assigned = await db
        .select({ assignedToUserId: programs.assignedToUserId })
        .from(programs)
        .where(and(eq(programs.ownerId, user.id), inArray(programs.assignedToUserId, clientIds)));

      const weights = await db
        .select({
          userId: weightEntries.userId,
          date: weightEntries.date,
          weightKg: weightEntries.weightKg,
        })
        .from(weightEntries)
        .where(inArray(weightEntries.userId, clientIds))
        .orderBy(desc(weightEntries.date));

      const since = fourWeeksAgo();

      return {
        items: rows.map(({ relation, user: client }) => {
          const theirs = workouts.filter((row) => row.userId === client.id);
          const last = theirs.reduce<Date | null>(
            (latest, row) => (latest === null || row.finishedAt > latest ? row.finishedAt : latest),
            null,
          );

          return {
            relationId: relation.id,
            userId: client.id,
            name: client.name,
            email: client.email,
            status: relation.status,
            since: (relation.acceptedAt ?? relation.invitedAt).toISOString(),
            lastWorkoutAt: last ? last.toISOString() : null,
            workoutsLast28Days: theirs.filter((row) => row.finishedAt >= since).length,
            assignedPrograms: assigned.filter((row) => row.assignedToUserId === client.id).length,
            latestWeightKg: weights.find((row) => row.userId === client.id)?.weightKg ?? null,
          };
        }),
      };
    },
  );

  app.get(
    '/coach/clients/:id',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        response: { 200: clientDetailSchema, 404: apiErrorSchema },
      },
    },
    async (request) => {
      const user = currentUser(request);
      await assertIsCoach(user.id);

      const relation = await assertActiveClient(user.id, request.params.id);

      const [client] = await db.select().from(users).where(eq(users.id, request.params.id));
      if (!client) throw notFound('coach/client-not-found', 'Client introuvable.');

      const clientPrograms = await db
        .select({ program: programs })
        .from(programs)
        .where(and(eq(programs.ownerId, user.id), eq(programs.assignedToUserId, client.id)))
        .orderBy(desc(programs.updatedAt));

      const programIds = clientPrograms.map((row) => row.program.id);

      const sessionCounts = programIds.length
        ? await db
            .select({ programId: sessions.programId, id: sessions.id })
            .from(sessions)
            .where(inArray(sessions.programId, programIds))
        : [];

      const scheduleRows = programIds.length
        ? await db
            .select({ programId: weeklySchedule.programId, sessionId: weeklySchedule.sessionId })
            .from(weeklySchedule)
            .where(inArray(weeklySchedule.programId, programIds))
        : [];

      const workouts = await db
        .select()
        .from(workoutLogs)
        .where(eq(workoutLogs.userId, client.id))
        .orderBy(desc(workoutLogs.finishedAt))
        .limit(30);

      const weights = await db
        .select({ date: weightEntries.date, weightKg: weightEntries.weightKg })
        .from(weightEntries)
        .where(eq(weightEntries.userId, client.id))
        .orderBy(weightEntries.date);

      const since = fourWeeksAgo();

      return {
        client: {
          relationId: relation.id,
          userId: client.id,
          name: client.name,
          email: client.email,
          status: relation.status,
          since: (relation.acceptedAt ?? relation.invitedAt).toISOString(),
          lastWorkoutAt: workouts[0]?.finishedAt.toISOString() ?? null,
          workoutsLast28Days: workouts.filter((row) => row.finishedAt >= since).length,
          assignedPrograms: clientPrograms.length,
          latestWeightKg: weights[weights.length - 1]?.weightKg ?? null,
        },
        programs: clientPrograms.map(({ program }) => ({
          id: program.id,
          title: program.title,
          sessionCount: sessionCounts.filter((row) => row.programId === program.id).length,
          trainingDays: scheduleRows.filter(
            (row) => row.programId === program.id && row.sessionId !== null,
          ).length,
          updatedAt: program.updatedAt.toISOString(),
        })),
        workouts: workouts.map((row) => ({
          id: row.id,
          sessionName: row.sessionName,
          finishedAt: row.finishedAt.toISOString(),
          durationSeconds: row.durationSeconds,
          totalVolumeKg: row.totalVolumeKg,
          completedSets: row.completedSets,
        })),
        weights: weightTrend(weights),
      };
    },
  );

  /**
   * Assigner un programme : on en fait une **copie** liée au client.
   *
   * Le coach peut ensuite adapter cette copie sans toucher à son modèle.
   */
  app.post(
    '/coach/clients/:id/programs',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: assignProgramSchema,
        response: { 201: z.object({ programId: z.uuid() }), 404: apiErrorSchema },
      },
    },
    async (request, reply) => {
      const user = currentUser(request);
      await assertIsCoach(user.id);
      await assertActiveClient(user.id, request.params.id);

      const source = await loadProgram(request.body.programId);

      if (!source || source.ownerId !== user.id) {
        throw notFound('program/not-found', 'Programme introuvable.');
      }

      const input: ProgramInput = {
        title: request.body.title ?? source.title,
        isTemplate: false,
        details: source.details,
        sessions: source.sessions.map((session) => ({
          label: session.label,
          name: session.name,
          targetMuscles: session.targetMuscles,
          durationMinutes: session.durationMinutes,
          warmup: session.warmup,
          cooldown: session.cooldown,
          exercises: session.exercises.map((line) => ({
            exerciseId: line.exerciseId,
            sets: line.sets,
            reps: line.reps,
            load: line.load,
            restSeconds: line.restSeconds,
            tempo: line.tempo,
            notes: line.notes,
          })),
        })),
        schedule: source.schedule,
      };

      const copy = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(programs)
          .values({
            ownerId: user.id,
            kind: 'training',
            title: input.title,
            isTemplate: false,
            sourceProgramId: source.id,
            assignedToUserId: request.params.id,
          })
          .returning({ id: programs.id });

        if (!created) throw badRequest('program/assign-failed', 'Assignation impossible.');

        await writeContents(tx, created.id, input);

        return created;
      });

      return reply.status(201).send({ programId: copy.id });
    },
  );
};
