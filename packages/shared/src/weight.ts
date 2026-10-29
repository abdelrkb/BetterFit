import { z } from 'zod';
import { weightPointSchema, type WeightPoint } from './coaching.js';
import { dateOnlySchema, weightKgSchema } from './profile.js';

/**
 * Le suivi du poids : une mesure par jour, et la tendance lissée.
 *
 * Le poids n'est pas dans le profil : le profil décrit ce qui ne bouge pas,
 * le poids est une mesure datée. La moyenne glissante vit dans
 * `weightTrend` (voir `coaching.ts`), jamais recalculée ailleurs.
 */

/** Ce que l'app envoie quand on pèse. La date vaut aujourd'hui par défaut. */
export const weightEntryInputSchema = z.object({
  weightKg: weightKgSchema,
  date: dateOnlySchema.optional(),
});
export type WeightEntryInput = z.infer<typeof weightEntryInputSchema>;

export const weightHistorySchema = z.object({
  /** Les mesures du plus ancien au plus récent, avec leur tendance. */
  points: z.array(weightPointSchema),
  /** La dernière mesure, ou `null` si on ne s'est jamais pesé. */
  latestWeightKg: z.number().nullable(),
  /**
   * Écart entre la tendance d'aujourd'hui et celle d'il y a une semaine.
   * Négatif quand on perd. `null` tant qu'il n'y a pas assez de mesures.
   */
  weeklyChangeKg: z.number().nullable(),
});
export type WeightHistory = z.infer<typeof weightHistorySchema>;

/** Nombre de jours d'historique que l'app demande par défaut. */
export const WEIGHT_HISTORY_DAYS = 90;

/**
 * Variation de la tendance sur les sept derniers jours, en kilos.
 *
 * On compare deux tendances, jamais deux pesées : d'un jour à l'autre le
 * poids bouge d'un kilo pour de l'eau. Renvoie `null` tant qu'on n'a pas une
 * mesure d'au moins une semaine en arrière — annoncer « −2 kg » à partir de
 * deux pesées à deux jours d'écart serait faux.
 */
export function weeklyChangeKg(points: WeightPoint[]): number | null {
  if (points.length < 2) return null;

  const last = points[points.length - 1]!;
  const lastTime = Date.parse(`${last.date}T00:00:00Z`);

  // La mesure la plus récente qui date d'au moins sept jours.
  const earlier = [...points]
    .reverse()
    .find((point) => lastTime - Date.parse(`${point.date}T00:00:00Z`) >= WEEK_MS);

  if (!earlier) return null;

  return Math.round((last.trendKg - earlier.trendKg) * 10) / 10;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
