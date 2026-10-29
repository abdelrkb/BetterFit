import { Linking, Platform } from 'react-native';
import { z } from 'zod';
import { apiBaseUrl } from './api';
import { useSession } from '../stores/session';

const linkSchema = z.object({ url: z.string(), expiresAt: z.number().int() });

export type PdfKind = 'training' | 'nutrition';

/**
 * Ouvre le PDF d'un programme.
 *
 * On demande d'abord un **lien signé** à l'API, puis on l'ouvre : ni un
 * lecteur PDF ni la feuille de partage du téléphone ne savent envoyer un
 * en-tête d'authentification. Le lien expire au bout de dix minutes.
 *
 * Sur le web, le navigateur affiche le PDF dans un nouvel onglet ; sur
 * téléphone, le système l'ouvre avec son lecteur, d'où on peut l'envoyer ou
 * l'enregistrer.
 */
export async function openProgramPdf(
  kind: PdfKind,
  programId: string,
  pages?: string[],
): Promise<void> {
  const link = await useSession
    .getState()
    .authedRequest(
      `/pdf/${kind}/${programId}/link`,
      { method: 'POST', body: pages ? { pages } : {} },
      (data) => linkSchema.parse(data),
    );

  const url = `${apiBaseUrl}${link.url}`;

  if (Platform.OS === 'web') {
    // `noopener` : la page ouverte ne doit pas pouvoir manipuler la nôtre.
    globalThis.open?.(url, '_blank', 'noopener');
    return;
  }

  await Linking.openURL(url);
}
