import {
  NUTRITION_PDF_PAGES,
  TRAINING_PDF_PAGES,
  renderNutritionPdf,
  renderTrainingPdf,
  type Branding,
} from '@betterfit/pdf-templates';
import { eq } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { currentUser } from '../auth/plugin.js';
import { db } from '../db/client.js';
import { coachSettings, users } from '../db/schema.js';
import { notFound } from '../errors.js';
import { pdfLink, verifyPdfLink, type PdfKind } from '../pdf/links.js';
import { renderPdf } from '../pdf/render.js';
import { loadNutritionProgram } from './nutrition.js';
import { loadProgram } from './programs.js';

/**
 * L'export PDF.
 *
 * Le document est généré **à la demande**, jamais stocké : un programme
 * modifié doit sortir à jour, et garder des PDF périmés sur le disque ne
 * rendrait service à personne.
 *
 * Deux routes : l'app demande un **lien signé** (authentifiée), puis ouvre
 * ou partage ce lien. Ni un lecteur PDF ni une feuille de partage ne savent
 * envoyer un en-tête `Authorization`.
 */

/** Le nom et les couleurs à mettre sur le document. */
async function brandingFor(userId: string): Promise<Branding> {
  const [coach] = await db.select().from(coachSettings).where(eq(coachSettings.userId, userId));

  if (coach) {
    return { coachName: coach.displayName, contact: coach.contact, accent: coach.accentColor };
  }

  // Quelqu'un qui s'est fait son programme tout seul : c'est son nom qui
  // figure en pied de page, pas celui d'un coach qui n'existe pas.
  const [user] = await db.select().from(users).where(eq(users.id, userId));

  return { coachName: user?.name ?? 'BetterFit', contact: '', accent: '#6B3FD9' };
}

/** Un nom de fichier lisible et sans surprise pour le système de fichiers. */
function fileName(title: string, suffix: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);

  return `${base.length > 0 ? base : 'programme'}-${suffix}.pdf`;
}

/**
 * Les pages demandées, filtrées sur celles qui existent.
 *
 * Une liste vide ou inconnue rend toutes les pages : mieux vaut un document
 * complet qu'un document vide quand le paramètre est mal formé.
 */
function parsePages<T extends string>(raw: string | undefined, all: readonly T[]): readonly T[] {
  if (!raw) return all;

  const asked = raw.split(',').map((name) => name.trim());
  const kept = all.filter((name) => asked.includes(name));

  return kept.length > 0 ? kept : all;
}

/** Compose le document, ou `null` si la personne n'y a pas droit. */
async function buildPdf(
  kind: PdfKind,
  id: string,
  userId: string,
  pagesParam: string | undefined,
): Promise<{ pdf: Buffer; fileName: string } | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  if (kind === 'training') {
    const program = await loadProgram(id);

    // Le propriétaire et le client à qui il est assigné peuvent l'exporter.
    if (!program || (program.ownerId !== userId && program.assignedToUserId !== userId)) {
      return null;
    }

    const html = renderTrainingPdf(program, {
      branding: await brandingFor(program.ownerId),
      pages: parsePages(pagesParam, TRAINING_PDF_PAGES),
      clientName: program.assignedToUserId === userId ? user.name : '',
    });

    return { pdf: await renderPdf(html), fileName: fileName(program.title, 'muscu') };
  }

  const program = await loadNutritionProgram(id);

  if (!program || (program.ownerId !== userId && program.assignedToUserId !== userId)) {
    return null;
  }

  const html = renderNutritionPdf(program, {
    branding: await brandingFor(program.ownerId),
    pages: parsePages(pagesParam, NUTRITION_PDF_PAGES),
    clientName: program.assignedToUserId === userId ? user.name : '',
  });

  return { pdf: await renderPdf(html), fileName: fileName(program.title, 'nutrition') };
}

export const pdfRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Le document lui-même, servi sur signature.
   *
   * Déclarée **hors** du périmètre authentifié, et c'est volontaire : un
   * lecteur PDF ne porte pas de jeton. La signature couvre le programme, le
   * demandeur et les pages, et expire au bout de dix minutes.
   */
  app.get(
    '/pdf/:kind/:id',
    {
      schema: {
        params: z.object({ kind: z.enum(['training', 'nutrition']), id: z.uuid() }),
        querystring: z.object({
          user: z.uuid(),
          expires: z.coerce.number().int(),
          token: z.string().max(128),
          pages: z.string().max(200).optional(),
        }),
      },
    },
    async (request, reply) => {
      const { kind, id } = request.params;
      const { user, expires, token, pages } = request.query;

      const valid = verifyPdfLink({
        kind,
        id,
        userId: user,
        pages: pages ?? '',
        expires,
        token,
      });

      if (!valid) throw notFound('pdf/link-expired', 'Lien expiré ou invalide.');

      const built = await buildPdf(kind, id, user, pages);
      if (!built) throw notFound('pdf/not-found', 'Programme introuvable.');

      return reply
        .type('application/pdf')
        .header('content-disposition', `inline; filename="${built.fileName}"`)
        // Privé : jamais mis en cache par un intermédiaire partagé.
        .header('cache-control', 'private, no-store')
        .send(built.pdf);
    },
  );

  const secureRoutes: FastifyPluginAsyncZod = async (secure) => {
    secure.addHook('onRequest', secure.requireAuth);

    /** Demande un lien signé vers le PDF d'un programme. */
    secure.post(
      '/pdf/:kind/:id/link',
      {
        schema: {
          params: z.object({ kind: z.enum(['training', 'nutrition']), id: z.uuid() }),
          body: z
            .object({ pages: z.array(z.string().max(40)).max(20).optional() })
            .nullish(),
          response: { 200: z.object({ url: z.string(), expiresAt: z.number().int() }) },
        },
      },
      async (request) => {
        const me = currentUser(request);
        const { kind, id } = request.params;
        const pages = (request.body?.pages ?? []).join(',');

        // On vérifie le droit **avant** de signer : un lien ne doit jamais
        // être émis pour un programme qu'on ne peut pas voir.
        const program =
          kind === 'training' ? await loadProgram(id) : await loadNutritionProgram(id);

        if (!program || (program.ownerId !== me.id && program.assignedToUserId !== me.id)) {
          throw notFound('pdf/not-found', 'Programme introuvable.');
        }

        const link = pdfLink({ kind, id, userId: me.id, pages });

        return { url: link.path, expiresAt: link.expiresAt };
      },
    );
  };

  await app.register(secureRoutes);
};
