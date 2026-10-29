/**
 * Traduction des noms d'exercices, de l'anglais vers le français.
 *
 * Les noms de free-exercise-db suivent presque toujours la même construction :
 * `[matériel] [position] [prise] [mouvement]`. Le français inverse l'ordre :
 * `[mouvement] [prise] [position] [matériel]`. On reconnaît donc les morceaux,
 * puis on réassemble.
 *
 * Quand le mouvement n'est pas reconnu, on **garde le nom anglais** plutôt que
 * d'inventer une traduction approximative : beaucoup de mouvements n'ont pas
 * d'équivalent français courant, et un coach préfère « Turkish Get-Up » à une
 * traduction mot à mot. Les corrections se font dans
 * `data/exercises/name-overrides.json` ou depuis l'application.
 */

/** Enlève les accents et normalise la ponctuation, pour comparer. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-/]/g, ' ')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Le mouvement, c'est-à-dire le cœur du nom. Les entrées les plus longues sont
 * essayées d'abord : « bench press » avant « press ».
 */
const MOVEMENTS: [pattern: string, french: string][] = [
  // Développés
  ['bench press', 'Développé couché'],
  ['chest press', 'Développé pectoraux'],
  ['shoulder press', 'Développé militaire'],
  ['overhead press', 'Développé militaire'],
  ['military press', 'Développé militaire'],
  ['floor press', 'Développé au sol'],
  ['push press', 'Développé jeté'],
  ['leg press', 'Presse à cuisses'],
  ['calf press', 'Presse à mollets'],
  ['chest fly', 'Écartés'],
  ['press', 'Développé'],

  // Jambes
  ['front squat', 'Squat avant'],
  ['hack squat', 'Hack squat'],
  ['split squat', 'Squat bulgare'],
  ['sissy squat', 'Sissy squat'],
  ['goblet squat', 'Goblet squat'],
  ['squat', 'Squat'],
  ['romanian deadlift', 'Soulevé de terre roumain'],
  ['stiff leg deadlift', 'Soulevé de terre jambes tendues'],
  ['straight leg deadlift', 'Soulevé de terre jambes tendues'],
  ['sumo deadlift', 'Soulevé de terre sumo'],
  ['deadlift', 'Soulevé de terre'],
  ['good morning', 'Good morning'],
  ['lunge', 'Fente'],
  ['step up', 'Montée sur banc'],
  ['leg extension', 'Leg extension'],
  ['leg curl', 'Leg curl'],
  ['calf raise', 'Extensions des mollets'],
  ['hip thrust', 'Hip thrust'],
  ['glute bridge', 'Pont fessier'],
  ['bridge', 'Pont'],
  ['pelvic tilt', 'Bascule du bassin'],

  // Dos
  ['upright row', 'Rowing menton'],
  ['inverted row', 'Rowing inversé'],
  ['row', 'Rowing'],
  ['lat pulldown', 'Tirage vertical'],
  ['pulldown', 'Tirage vertical'],
  ['pullover', 'Pull-over'],
  ['face pull', 'Face pull'],
  ['pull up', 'Traction'],
  ['pullup', 'Traction'],
  ['chin up', 'Traction supination'],
  ['chinup', 'Traction supination'],
  ['shrug', 'Haussements d’épaules'],
  ['hyperextension', 'Hyperextension'],
  ['back extension', 'Extension lombaire'],

  // Épaules et bras
  ['lateral raise', 'Élévations latérales'],
  ['side lateral raise', 'Élévations latérales'],
  ['front raise', 'Élévations frontales'],
  ['rear delt raise', 'Oiseau'],
  ['reverse fly', 'Oiseau'],
  ['leg raise', 'Relevé de jambes'],
  ['knee raise', 'Relevé de genoux'],
  ['raise', 'Élévations'],
  ['hammer curl', 'Curl marteau'],
  ['preacher curl', 'Curl au pupitre'],
  ['concentration curl', 'Curl concentration'],
  ['wrist curl', 'Curl poignets'],
  ['curl', 'Curl'],
  ['skullcrusher', 'Barre au front'],
  ['skull crusher', 'Barre au front'],
  ['pushdown', 'Extension triceps'],
  ['kickback', 'Kickback'],
  ['triceps extension', 'Extension triceps'],
  ['tricep extension', 'Extension triceps'],
  ['extension', 'Extension'],
  ['dip', 'Dips'],

  // Pectoraux
  ['flye', 'Écartés'],
  ['fly', 'Écartés'],
  ['crossover', 'Écartés à la poulie'],
  ['push up', 'Pompes'],
  ['pushup', 'Pompes'],

  // Gainage et abdos
  ['sit up', 'Relevé de buste'],
  ['situp', 'Relevé de buste'],
  ['crunch', 'Crunch'],
  ['plank', 'Gainage'],
  ['russian twist', 'Russian twist'],
  ['twist', 'Rotation du buste'],
  ['rollout', 'Roulette abdominale'],
  ['wood chop', 'Woodchopper'],
  ['chop', 'Woodchopper'],

  // Haltérophilie
  ['clean and jerk', 'Épaulé-jeté'],
  ['power clean', 'Épaulé debout'],
  ['hang clean', 'Épaulé depuis les cuisses'],
  ['clean', 'Épaulé'],
  ['snatch', 'Arraché'],
  ['jerk', 'Jeté'],
  ['thruster', 'Thruster'],
  ['swing', 'Swing'],

  // Cardio et pliométrie
  ['box jump', 'Saut sur boîte'],
  ['jump', 'Saut'],
  ['sprint', 'Sprint'],
  ['run', 'Course'],
  ['jogging', 'Footing'],
  ['skipping', 'Corde à sauter'],
  ['mountain climber', 'Montées de genoux au sol'],
  ['burpee', 'Burpee'],

  // Étirements et mobilité
  ['stretch', 'Étirement'],
  ['smr', 'Automassage'],
  ['foam roll', 'Rouleau de massage'],
  ['circles', 'Cercles'],
  ['rotation', 'Rotation'],
];

/** Matériel : devient un complément à la fin du nom français. */
const EQUIPMENT: [pattern: string, french: string][] = [
  ['smith machine', 'à la Smith machine'],
  ['e z bar', 'à la barre EZ'],
  ['ez bar', 'à la barre EZ'],
  ['e z curl bar', 'à la barre EZ'],
  ['barbell', 'à la barre'],
  ['dumbbell', 'avec haltères'],
  ['kettlebell', 'avec kettlebell'],
  ['kettlebells', 'avec kettlebells'],
  ['medicine ball', 'avec médecine-ball'],
  ['exercise ball', 'sur swiss ball'],
  ['stability ball', 'sur swiss ball'],
  ['physioball', 'sur swiss ball'],
  ['bosu ball', 'sur Bosu'],
  ['cable', 'à la poulie'],
  ['pulley', 'à la poulie'],
  ['rope', 'à la corde'],
  ['machine', 'à la machine'],
  ['leverage', 'à la machine'],
  ['lever', 'à la machine'],
  ['band', 'avec élastique'],
  ['bands', 'avec élastiques'],
  ['sled', 'au traîneau'],
  ['plate', 'avec disque'],
  ['chain', 'avec chaînes'],
  ['chains', 'avec chaînes'],
  ['weighted', 'lesté'],
  ['bodyweight', 'au poids du corps'],
];

/** Position du corps. */
const POSITIONS: [pattern: string, french: string][] = [
  ['bent over', 'penché'],
  ['bent knee', 'genoux fléchis'],
  ['standing', 'debout'],
  ['seated', 'assis'],
  ['lying', 'allongé'],
  ['kneeling', 'à genoux'],
  ['prone', 'à plat ventre'],
  ['supine', 'sur le dos'],
  ['incline', 'incliné'],
  ['decline', 'décliné'],
  ['hanging', 'suspendu'],
  ['overhead', 'au-dessus de la tête'],
  ['behind the neck', 'nuque'],
  ['behind neck', 'nuque'],
  ['behind the back', 'derrière le dos'],
  ['behind back', 'derrière le dos'],
  ['palms up', 'paumes vers le haut'],
  ['palms down', 'paumes vers le bas'],
  ['palms in', 'paumes face à face'],
  ['palm up', 'paume vers le haut'],
  ['palm down', 'paume vers le bas'],
  ['feet elevated', 'pieds surélevés'],
  ['elevated', 'surélevé'],
  ['suspended', 'suspendu'],
  ['on bench', 'sur banc'],
  ['bench', 'sur banc'],
  ['box', 'sur boîte'],
  ['chair', 'sur chaise'],
  ['side', 'latéral'],
  ['front', 'devant'],
  ['rear', 'arrière'],
  ['walking', 'marché'],
  ['floor', 'au sol'],
  ['wall', 'au mur'],
];

/** Qualificatifs : largeur de prise, amplitude, intensité. */
const MODIFIERS: [pattern: string, french: string][] = [
  ['wide', 'large'],
  ['narrow', 'serré'],
  ['close', 'serré'],
  ['high', 'haut'],
  ['low', 'bas'],
  ['long', 'long'],
  ['short', 'court'],
  ['straight', 'tendu'],
  ['stiff', 'tendu'],
  ['bent', 'fléchi'],
  ['split', 'fendu'],
  ['external', 'externe'],
  ['internal', 'interne'],
  ['full', 'complet'],
  ['half', 'demi'],
  ['partial', 'partiel'],
  ['heavy', 'lourd'],
  ['double', 'double'],
  ['two', 'à deux'],
  ['isometric', 'isométrique'],
  ['dynamic', 'dynamique'],
  ['assisted', 'assisté'],
  ['explosive', 'explosif'],
  ['slow', 'lent'],
  ['sumo', 'sumo'],
  ['romanian', 'roumain'],
  ['olympic', 'olympique'],
  ['power', 'power'],
  ['hang', 'depuis les cuisses'],
];

/** Prise et nombre de membres. */
const GRIPS: [pattern: string, french: string][] = [
  ['close grip', 'prise serrée'],
  ['wide grip', 'prise large'],
  ['narrow grip', 'prise serrée'],
  ['medium grip', 'prise moyenne'],
  ['neutral grip', 'prise neutre'],
  ['reverse grip', 'prise inversée'],
  ['underhand', 'en supination'],
  ['supinated', 'en supination'],
  ['pronated', 'en pronation'],
  ['one arm', 'à un bras'],
  ['single arm', 'à un bras'],
  ['one leg', 'à une jambe'],
  ['single leg', 'à une jambe'],
  ['one legged', 'à une jambe'],
  ['single leg', 'à une jambe'],
  ['alternating', 'alterné'],
  ['alternate', 'alterné'],
  ['two arm', 'à deux bras'],
  ['reverse', 'inversé'],
];

/** Muscle nommé dans le titre : « Triceps Pushdown ». */
const MUSCLE_WORDS: [pattern: string, french: string][] = [
  ['triceps', 'triceps'],
  ['tricep', 'triceps'],
  ['biceps', 'biceps'],
  ['bicep', 'biceps'],
  ['calf', 'mollets'],
  ['glute', 'fessiers'],
  ['hamstring', 'ischio-jambiers'],
  ['quad', 'quadriceps'],
  ['oblique', 'obliques'],
  ['lat', 'dorsaux'],
  ['chest', 'pectoraux'],
  ['shoulder', 'épaules'],
  ['hip', 'hanches'],
  ['ankle', 'chevilles'],
  ['neck', 'cou'],
  ['groin', 'adducteurs'],
  ['wrist', 'poignets'],
  ['forearm', 'avant-bras'],
  ['leg', 'jambes'],
  ['arm', 'bras'],
  ['knee', 'genoux'],
  ['thigh', 'cuisses'],
  ['abdominal', 'abdominaux'],
  ['delt', 'deltoïdes'],
];

/** Retire la première occurrence d'un motif et renvoie la traduction trouvée. */
function take(
  text: string,
  table: readonly [string, string][],
): { text: string; french: string | null } {
  // Les motifs longs d'abord : « bench press » doit gagner contre « press ».
  const sorted = [...table].sort((a, b) => b[0].length - a[0].length);

  for (const [pattern, french] of sorted) {
    const regex = new RegExp(`(^|\\s)${pattern}s?(\\s|$)`);
    if (regex.test(text)) {
      return { text: text.replace(regex, ' ').replace(/\s+/g, ' ').trim(), french };
    }
  }

  return { text, french: null };
}

/**
 * Retire **toutes** les occurrences : « Standing Bent-Over … » porte deux
 * positions, et n'en garder qu'une laisserait un mot anglais traîner.
 */
function takeAll(
  text: string,
  table: readonly [string, string][],
): { text: string; french: string[] } {
  const found: string[] = [];
  let rest = text;

  for (;;) {
    const step = take(rest, table);
    if (!step.french) break;

    found.push(step.french);
    rest = step.text;
  }

  return { text: rest, french: found };
}

export type TranslatedName = {
  name: string;
  /** Faux quand on a gardé l'anglais faute de mouvement reconnu. */
  translated: boolean;
};

/**
 * Traduit un nom d'exercice. Renvoie le nom anglais inchangé quand aucun
 * mouvement connu n'est reconnu.
 */
export function translateExerciseName(englishName: string): TranslatedName {
  let rest = normalize(englishName);

  const movement = take(rest, MOVEMENTS);
  if (!movement.french) return { name: englishName, translated: false };
  rest = movement.text;

  const grip = takeAll(rest, GRIPS);
  rest = grip.text;

  const position = takeAll(rest, POSITIONS);
  rest = position.text;

  const equipment = takeAll(rest, EQUIPMENT);
  rest = equipment.text;

  const muscle = takeAll(rest, MUSCLE_WORDS);
  rest = muscle.text;

  const modifier = takeAll(rest, MODIFIERS);
  rest = modifier.text;

  const parts = [movement.french];

  // « Extension triceps » plutôt que « Extension » puis « triceps » ailleurs :
  // le muscle colle au mouvement.
  for (const french of muscle.french) {
    if (!movement.french.toLowerCase().includes(french)) parts.push(french);
  }

  parts.push(...modifier.french, ...grip.french, ...position.french, ...equipment.french);

  // Ce qui reste est un qualificatif qu'on ne sait pas traduire (« Arnold »,
  // « Zottman »…). On le garde tel quel, à la fin, pour ne rien perdre.
  const leftover = rest
    .split(' ')
    .filter((word) => word.length > 0 && !IGNORED_WORDS.has(word))
    .join(' ');

  if (leftover.length > 0) {
    parts.push(capitalizeProperNoun(leftover, englishName));
  }

  return { name: parts.join(' '), translated: true };
}

/** Mots vides anglais qui ne portent pas de sens une fois le reste traduit. */
const IGNORED_WORDS = new Set([
  'the',
  'a',
  'an',
  'with',
  'and',
  'to',
  'on',
  'in',
  'of',
  'from',
  'for',
  'at',
  'or',
  'your',
  'up',
  'ups',
  'down',
  'exercise',
  'version',
  'style',
  'position',
  'bar',
]);

/**
 * Remet les majuscules d'origine sur les mots gardés en anglais : « arnold »
 * redevient « Arnold » si c'est ainsi qu'il était écrit.
 */
function capitalizeProperNoun(leftover: string, originalName: string): string {
  return leftover
    .split(' ')
    .map((word) => {
      const original = originalName
        .split(/[\s/-]+/)
        .find((candidate) => normalize(candidate) === word);

      return original ?? word;
    })
    .join(' ');
}
