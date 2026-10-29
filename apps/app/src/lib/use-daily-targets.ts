import {
  DEFAULT_DEFICIT_KCAL,
  DEFAULT_FAT_G_PER_KG,
  DEFAULT_PROTEIN_G_PER_KG,
  ageFromBirthDate,
  computeNutritionTargets,
  type NutritionTargets,
} from '@betterfit/shared';
import { useSession } from '@/stores/session';

/**
 * Les objectifs nutritionnels du jour, déduits du profil et du dernier poids.
 *
 * Le calcul lui-même vit dans `packages/shared` : ce hook ne fait que lui
 * fournir le profil et renvoyer `null` tant qu'il manque une donnée. Un
 * programme de nutrition assigné par un coach prendra le dessus à l'étape 7.
 */
export function useDailyTargets(): NutritionTargets | null {
  const profile = useSession((state) => state.profile);
  const latestWeightKg = useSession((state) => state.latestWeightKg);

  if (!profile || latestWeightKg === null) return null;

  const age = ageFromBirthDate(profile.birthDate);
  if (age === null) return null;

  return computeNutritionTargets({
    sex: profile.sex,
    age,
    weightKg: latestWeightKg,
    heightCm: profile.heightCm,
    activityLevel: profile.activityLevel,
    deficitKcal: DEFAULT_DEFICIT_KCAL[profile.goal],
    proteinGPerKg: DEFAULT_PROTEIN_G_PER_KG,
    fatGPerKg: DEFAULT_FAT_G_PER_KG,
    waterLiters: null,
  });
}
