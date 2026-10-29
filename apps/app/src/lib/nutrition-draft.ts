import {
  DEFAULT_SHOPPING_CATEGORIES,
  ageFromBirthDate,
  type Meal,
  type MealItem,
  type NutritionProgram,
  type NutritionProgramInput,
  type Profile,
  type ShoppingCategory,
  type ShoppingItem,
} from '@betterfit/shared';

/**
 * Le brouillon manipulé par l'éditeur de programme alimentaire.
 *
 * Ici le brouillon **est** ce que l'API attend : à l'étape 7 les lignes de
 * repas sont en texte libre, il n'y a donc rien à aller chercher ailleurs
 * pour les afficher. L'éditeur peut travailler directement sur l'entrée.
 */
export type NutritionDraft = NutritionProgramInput;

export function emptyMealItem(): MealItem {
  return {
    foodId: null,
    label: '',
    quantity: '',
    quantityG: null,
    alternative: '',
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
}

export function emptyShoppingItem(): ShoppingItem {
  return { label: '', quantity: '', checked: false, priceCents: null, store: '' };
}

/** Les repas proposés par défaut, repris du prototype. */
function defaultMeals(): Meal[] {
  return [
    { name: 'Petit-déjeuner', time: '07h30', kcalOverride: null, items: rows(3) },
    { name: 'Collation', time: '10h30', kcalOverride: null, items: rows(2) },
    { name: 'Déjeuner', time: '12h30', kcalOverride: null, items: rows(4) },
    { name: 'Collation', time: '16h30', kcalOverride: null, items: rows(2) },
    { name: 'Dîner', time: '20h00', kcalOverride: null, items: rows(3) },
  ];
}

function defaultShopping(): ShoppingCategory[] {
  return DEFAULT_SHOPPING_CATEGORIES.map((name) => ({
    name,
    items: Array.from({ length: 4 }, emptyShoppingItem),
  }));
}

function rows(count: number): MealItem[] {
  return Array.from({ length: count }, emptyMealItem);
}

/**
 * Un brouillon neuf, prérempli avec le profil quand il existe.
 *
 * Les chiffres sont **recopiés** : à partir de là, le programme vit sa vie.
 * Une pesée du lendemain ne doit pas changer rétroactivement les cibles d'un
 * plan déjà remis au client.
 */
export function emptyNutritionDraft(
  profile: Profile | null,
  latestWeightKg: number | null,
): NutritionDraft {
  const age = profile ? ageFromBirthDate(profile.birthDate) : null;

  return {
    title: '',
    isTemplate: false,
    startDate: null,
    endDate: null,
    settings: {
      sex: profile?.sex ?? 'female',
      age: age ?? 30,
      weightKg: latestWeightKg ?? 65,
      heightCm: profile?.heightCm ?? 168,
      activityLevel: profile?.activityLevel ?? 'moderate',
      deficitKcal: 400,
      proteinGPerKg: 2,
      fatGPerKg: 0.9,
      fiberG: 30,
      waterLiters: null,
      goalTitle: '',
      goalText: '',
      preferred: [],
      limited: [],
      coachNote: '',
      shoppingDays: 7,
      budgetCents: null,
    },
    meals: defaultMeals(),
    shopping: defaultShopping(),
    recipeIds: [],
  };
}

/** Le brouillon d'un programme existant, pour le modifier. */
export function draftFromProgram(program: NutritionProgram): NutritionDraft {
  return {
    title: program.title,
    isTemplate: program.isTemplate,
    startDate: program.startDate,
    endDate: program.endDate,
    settings: program.settings,
    meals: program.meals,
    shopping: program.shopping,
    recipeIds: program.recipeIds,
  };
}

/* ------------------------------------------------------------------ */
/* Modifications                                                        */
/* ------------------------------------------------------------------ */

export function addMeal(draft: NutritionDraft): NutritionDraft {
  return {
    ...draft,
    meals: [...draft.meals, { name: 'Repas', time: '', kcalOverride: null, items: rows(2) }],
  };
}

export function removeMeal(draft: NutritionDraft, index: number): NutritionDraft {
  return { ...draft, meals: draft.meals.filter((_, i) => i !== index) };
}

export function updateMeal(
  draft: NutritionDraft,
  index: number,
  patch: Partial<Meal>,
): NutritionDraft {
  return {
    ...draft,
    meals: draft.meals.map((meal, i) => (i === index ? { ...meal, ...patch } : meal)),
  };
}

export function addMealItem(draft: NutritionDraft, mealIndex: number): NutritionDraft {
  return updateMeal(draft, mealIndex, {
    items: [...(draft.meals[mealIndex]?.items ?? []), emptyMealItem()],
  });
}

export function removeMealItem(
  draft: NutritionDraft,
  mealIndex: number,
  itemIndex: number,
): NutritionDraft {
  return updateMeal(draft, mealIndex, {
    items: (draft.meals[mealIndex]?.items ?? []).filter((_, i) => i !== itemIndex),
  });
}

export function updateMealItem(
  draft: NutritionDraft,
  mealIndex: number,
  itemIndex: number,
  patch: Partial<MealItem>,
): NutritionDraft {
  return updateMeal(draft, mealIndex, {
    items: (draft.meals[mealIndex]?.items ?? []).map((item, i) =>
      i === itemIndex ? { ...item, ...patch } : item,
    ),
  });
}

export function addCategory(draft: NutritionDraft): NutritionDraft {
  return {
    ...draft,
    shopping: [...draft.shopping, { name: 'Rayon', items: [emptyShoppingItem()] }],
  };
}

export function removeCategory(draft: NutritionDraft, index: number): NutritionDraft {
  return { ...draft, shopping: draft.shopping.filter((_, i) => i !== index) };
}

export function updateCategory(
  draft: NutritionDraft,
  index: number,
  patch: Partial<ShoppingCategory>,
): NutritionDraft {
  return {
    ...draft,
    shopping: draft.shopping.map((category, i) =>
      i === index ? { ...category, ...patch } : category,
    ),
  };
}

export function addShoppingItem(draft: NutritionDraft, categoryIndex: number): NutritionDraft {
  return updateCategory(draft, categoryIndex, {
    items: [...(draft.shopping[categoryIndex]?.items ?? []), emptyShoppingItem()],
  });
}

export function removeShoppingItem(
  draft: NutritionDraft,
  categoryIndex: number,
  itemIndex: number,
): NutritionDraft {
  return updateCategory(draft, categoryIndex, {
    items: (draft.shopping[categoryIndex]?.items ?? []).filter((_, i) => i !== itemIndex),
  });
}

export function updateShoppingDraftItem(
  draft: NutritionDraft,
  categoryIndex: number,
  itemIndex: number,
  patch: Partial<ShoppingItem>,
): NutritionDraft {
  return updateCategory(draft, categoryIndex, {
    items: (draft.shopping[categoryIndex]?.items ?? []).map((item, i) =>
      i === itemIndex ? { ...item, ...patch } : item,
    ),
  });
}

/**
 * Nettoie le brouillon avant de l'envoyer : on enlève les lignes vides, que
 * l'éditeur affiche pour inviter à la saisie mais qui n'ont rien à faire en
 * base. Un repas sans nom disparaît aussi.
 */
export function toInput(draft: NutritionDraft): NutritionProgramInput {
  return {
    ...draft,
    meals: draft.meals
      .filter((meal) => meal.name.trim().length > 0)
      .map((meal) => ({
        ...meal,
        items: meal.items.filter((item) => item.label.trim().length > 0),
      })),
    shopping: draft.shopping
      .filter((category) => category.name.trim().length > 0)
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => item.label.trim().length > 0),
      })),
  };
}

/**
 * Ajoute une ligne qui cite un aliment de la base.
 *
 * Les macros ne sont **pas** calculées ici : c'est le serveur qui les calcule
 * à l'enregistrement, depuis l'aliment et la quantité. Les calculer aussi
 * dans l'app ferait deux endroits pour la même règle, et deux occasions de
 * diverger.
 */
export function addFoodToMeal(
  draft: NutritionDraft,
  mealIndex: number,
  food: { foodId: string; label: string; quantity: string; quantityG: number },
): NutritionDraft {
  return updateMeal(draft, mealIndex, {
    items: [...(draft.meals[mealIndex]?.items ?? []), { ...emptyMealItem(), ...food }],
  });
}
