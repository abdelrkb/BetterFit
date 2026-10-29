import { z } from 'zod';
import { accentChoices } from './theme.js';
import { emailSchema } from './auth.js';

/**
 * La relation coach ↔ client.
 *
 * Il n'y a qu'un type de compte : devenir coach, c'est activer un espace.
 * Un client n'a qu'un seul coach actif en V1.
 */

export const relationStatusSchema = z.enum(['pending', 'active', 'ended']);
export type RelationStatus = z.infer<typeof relationStatusSchema>;

/** Les trois façons d'inviter, reprises du cahier des charges. */
export const invitationKindSchema = z.enum(['email', 'code', 'in_app']);
export type InvitationKind = z.infer<typeof invitationKindSchema>;

export const INVITATION_CODE_LENGTH = 6;
export const INVITATION_DAYS = 7;

/** Code court, sans caractères qu'on confond : ni O/0, ni I/1. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const invitationCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(INVITATION_CODE_LENGTH, `Le code fait ${INVITATION_CODE_LENGTH} caractères.`)
  .regex(new RegExp(`^[${CODE_ALPHABET}]+$`), 'Ce code contient un caractère inattendu.');

export const coachSettingsSchema = z.object({
  /** Nom affiché sur les PDF et dans les invitations. */
  displayName: z.string().trim().min(1, 'Donne le nom que verront tes clients.').max(80),
  /** Adresse ou téléphone montré au client. */
  contact: z.string().trim().max(120).default(''),
  /** Couleur d'accent des PDF. */
  accentColor: z.enum(accentChoices).default(accentChoices[0]),
});
export type CoachSettings = z.infer<typeof coachSettingsSchema>;

/** Création d'une invitation, selon la façon choisie. */
export const invitationInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('email'), email: emailSchema }),
  z.object({ kind: z.literal('code') }),
  z.object({ kind: z.literal('in_app'), email: emailSchema }),
]);
export type InvitationInput = z.infer<typeof invitationInputSchema>;

export const invitationSchema = z.object({
  id: z.uuid(),
  kind: invitationKindSchema,
  /** Adresse visée, pour une invitation par e-mail ou dans l'app. */
  email: z.string().nullable(),
  /** Code à six caractères, seulement pour une invitation par code. */
  code: z.string().nullable(),
  status: z.enum(['pending', 'accepted', 'declined', 'expired', 'cancelled']),
  expiresAt: z.string(),
  createdAt: z.string(),
  /** Nom du destinataire quand il a déjà un compte. */
  targetName: z.string().nullable(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const invitationListSchema = z.object({ items: z.array(invitationSchema) });

/** Ce que le coach voit dans sa liste de clients. */
export const clientSummarySchema = z.object({
  relationId: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  status: relationStatusSchema,
  since: z.string(),
  /** Date de la dernière séance réalisée, pour repérer qui décroche. */
  lastWorkoutAt: z.string().nullable(),
  /** Nombre de séances sur les quatre dernières semaines. */
  workoutsLast28Days: z.number().int().min(0),
  assignedPrograms: z.number().int().min(0),
  latestWeightKg: z.number().nullable(),
});
export type ClientSummary = z.infer<typeof clientSummarySchema>;

export const clientListSchema = z.object({ items: z.array(clientSummarySchema) });

export const weightPointSchema = z.object({
  date: z.string(),
  weightKg: z.number(),
  /** Moyenne glissante sur sept jours : c'est la tendance qui compte. */
  trendKg: z.number(),
});
export type WeightPoint = z.infer<typeof weightPointSchema>;

/** La fiche d'un client, vue par son coach. */
export const clientDetailSchema = z.object({
  client: clientSummarySchema,
  programs: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      sessionCount: z.number().int().min(0),
      trainingDays: z.number().int().min(0),
      updatedAt: z.string(),
    }),
  ),
  workouts: z.array(
    z.object({
      id: z.uuid(),
      sessionName: z.string(),
      finishedAt: z.string(),
      durationSeconds: z.number().int().min(0),
      totalVolumeKg: z.number().min(0),
      completedSets: z.number().int().min(0),
    }),
  ),
  weights: z.array(weightPointSchema),
});
export type ClientDetail = z.infer<typeof clientDetailSchema>;

/** Ce qu'un utilisateur voit de sa propre situation de coaching. */
export const myCoachingSchema = z.object({
  /** Le coach actif, s'il y en a un. */
  coach: z
    .object({
      relationId: z.uuid(),
      userId: z.uuid(),
      displayName: z.string(),
      contact: z.string(),
      since: z.string(),
    })
    .nullable(),
  /** Les propositions reçues, à accepter ou refuser. */
  pending: z.array(
    z.object({
      relationId: z.uuid(),
      coachId: z.uuid(),
      coachName: z.string(),
      contact: z.string(),
      invitedAt: z.string(),
    }),
  ),
  /** Vrai si l'espace coach est activé sur ce compte. */
  isCoach: z.boolean(),
});
export type MyCoaching = z.infer<typeof myCoachingSchema>;

export const acceptCodeSchema = z.object({ code: invitationCodeSchema });

export const assignProgramSchema = z.object({
  programId: z.uuid(),
  /** Titre donné à la copie. Par défaut, celui du modèle. */
  title: z.string().trim().min(1).max(120).optional(),
});
export type AssignProgramInput = z.infer<typeof assignProgramSchema>;

/**
 * Moyenne glissante sur sept jours.
 *
 * Le poids varie de plus d'un kilo d'un jour à l'autre selon l'eau et la
 * digestion : c'est la tendance qu'il faut regarder, pas le chiffre du matin.
 */
export function weightTrend(
  entries: { date: string; weightKg: number }[],
  windowDays = 7,
): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((entry, index) => {
    const start = Math.max(0, index - windowDays + 1);
    const window = sorted.slice(start, index + 1);
    const sum = window.reduce((total, item) => total + item.weightKg, 0);

    return {
      date: entry.date,
      weightKg: entry.weightKg,
      trendKg: Math.round((sum / window.length) * 10) / 10,
    };
  });
}
