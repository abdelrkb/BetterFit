/**
 * Produit deux PDF d'exemple, remplis de données plausibles.
 *
 * Sert à regarder la mise en page sans créer de compte ni de programme :
 *
 *   pnpm --filter @betterfit/api pdf:sample [dossier] [--png]
 *
 * `--png` capture aussi chaque page en image, pour regarder la mise en page
 * sans ouvrir de lecteur PDF.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderNutritionPdf, renderTrainingPdf } from '@betterfit/pdf-templates';
import {
  dayTotals,
  trainingSessionLabel,
  targetsFromSettings,
  type Equipment,
  type ExerciseSummary,
  type Level,
  type NutritionProgram,
  type Program,
} from '@betterfit/shared';

/** Un résumé d'exercice complet, pour que l'exemple soit typé comme le vrai. */
function exercise(id: string, name: string, equipment: Equipment, level: Level): ExerciseSummary {
  return {
    id,
    name,
    nameEn: null,
    source: 'library',
    ownerId: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment,
    level,
    category: 'strength',
    force: null,
    mechanic: null,
    images: [],
    mascotPose: null,
    translated: true,
  };
}
import { closePdfRenderer, renderPdf, screenshotPages } from '../pdf/render.js';

const outDir = resolve(process.argv[2] ?? '.');

const settings: NutritionProgram['settings'] = {
  sex: 'female', age: 30, weightKg: 65, heightCm: 168, activityLevel: 'moderate',
  deficitKcal: 400, proteinGPerKg: 2, fatGPerKg: 0.9, fiberG: 30, waterLiters: null,
  goalTitle: 'Perte de gras',
  goalText: 'On vise 400 g par semaine, sans jamais avoir faim.',
  preferred: ['Légumes verts', 'Poisson blanc', 'Œufs'],
  limited: ['Sodas', 'Alcool'],
  coachNote: 'Bois avant d’avoir soif. Et dors : le sommeil fait partie du programme.',
  shoppingDays: 7, budgetCents: 6000,
};

const meals = [
  { id: 'a', name: 'Petit-déjeuner', time: '07h30', kcalOverride: null, items: [
    { id: '1', foodId: null, label: 'Flocons d’avoine', quantity: '60 g', quantityG: 60, alternative: 'Pain complet', kcal: 228, proteinG: 8.1, carbsG: 36, fatG: 4.2 },
    { id: '2', foodId: null, label: 'Skyr nature', quantity: '150 g', quantityG: 150, alternative: 'Fromage blanc 0 %', kcal: 96, proteinG: 17, carbsG: 6, fatG: 0.3 },
  ]},
  { id: 'b', name: 'Déjeuner', time: '12h30', kcalOverride: 650, items: [
    { id: '3', foodId: null, label: 'Riz basmati, cuit', quantity: '160 g', quantityG: 160, alternative: 'Pâtes complètes', kcal: 187, proteinG: 4.4, carbsG: 39, fatG: 1 },
    { id: '4', foodId: null, label: 'Blanc de poulet', quantity: '150 g', quantityG: 150, alternative: 'Dinde', kcal: 248, proteinG: 46, carbsG: 0, fatG: 5.4 },
    { id: '5', foodId: null, label: 'Légumes', quantity: 'à volonté', quantityG: null, alternative: '', kcal: null, proteinG: null, carbsG: null, fatG: null },
  ]},
  { id: 'c', name: 'Dîner', time: '20h00', kcalOverride: null, items: [
    { id: '6', foodId: null, label: 'Saumon', quantity: '130 g', quantityG: 130, alternative: 'Cabillaud', kcal: 270, proteinG: 26, carbsG: 0, fatG: 18 },
  ]},
];

const shopping = [
  { id: 's1', name: 'Protéines', items: [
    { id: 'i1', label: 'Blanc de poulet', quantity: '1 kg', checked: false, priceCents: 899, store: 'Lidl' },
    { id: 'i2', label: 'Saumon', quantity: '400 g', checked: false, priceCents: 1190, store: 'Carrefour' },
    { id: 'i3', label: 'Œufs', quantity: '12', checked: false, priceCents: 340, store: 'Lidl' },
  ]},
  { id: 's2', name: 'Féculents & céréales', items: [
    { id: 'i4', label: 'Riz basmati', quantity: '1 kg', checked: false, priceCents: 250, store: 'Lidl' },
    { id: 'i5', label: 'Flocons d’avoine', quantity: '500 g', checked: false, priceCents: 180, store: 'Lidl' },
  ]},
  { id: 's3', name: 'Fruits & légumes', items: [
    { id: 'i6', label: 'Brocoli', quantity: '1 kg', checked: false, priceCents: 299, store: 'Marché' },
    { id: 'i7', label: 'Pommes', quantity: '1,5 kg', checked: false, priceCents: 420, store: 'Marché' },
  ]},
  { id: 's4', name: 'Produits laitiers', items: [
    { id: 'i8', label: 'Skyr', quantity: '1 kg', checked: false, priceCents: 540, store: 'Carrefour' },
  ]},
];

const program: NutritionProgram = {
  id: 'p', ownerId: 'o', title: 'Sèche de printemps', isTemplate: false,
  startDate: null, endDate: null, assignedToUserId: null,
  settings, targets: targetsFromSettings(settings), meals, shopping, recipeIds: [],
  dayTotals: dayTotals(meals), updatedAt: new Date().toISOString(),
};

const branding = { coachName: 'Coach Abdel', contact: 'abdel@betterfit.app', accent: '#6B3FD9' };

writeFileSync(resolve(outDir, 'nutrition.pdf'), await renderPdf(renderNutritionPdf(program, { branding, clientName: 'Julie · Semaine 1' })));
console.log(`${resolve(outDir, 'nutrition.pdf')} écrit`);

const training: Program = {
  id: 't', ownerId: 'o', kind: 'training', title: 'Prise de masse', isTemplate: false,
  sourceProgramId: null, assignedToUserId: null,
  details: { goal: 'gain_muscle', level: 'intermediate', place: 'gym', sessionMinutes: 75, weeks: 8,
    coachNote: 'La technique avant la charge. Si la forme se casse, la série est finie.' },
  sessions: [
    { id: 's1', label: trainingSessionLabel(0), name: 'Bas du corps', targetMuscles: ['quadriceps', 'hamstrings', 'glutes'], durationMinutes: 75,
      warmup: 'Dix minutes de vélo, puis deux séries légères de squat.', cooldown: 'Étirements des quadriceps et des ischios.',
      exercises: [
        { id: 'e1', exerciseId: 'x', sets: 4, reps: '8', load: '80 kg', restSeconds: 150, tempo: '3-0-1', notes: 'Descends jusqu’à la parallèle.', exercise: exercise('x', 'Squat à la barre', 'barbell', 'intermediate') },
        { id: 'e2', exerciseId: 'y', sets: 3, reps: '10', load: '60 kg', restSeconds: 120, tempo: '', notes: '', exercise: exercise('y', 'Soulevé de terre roumain', 'barbell', 'intermediate') },
        { id: 'e3', exerciseId: 'z', sets: 3, reps: '12', load: '40 kg', restSeconds: 90, tempo: '', notes: 'Un côté après l’autre.', exercise: exercise('z', 'Fentes marchées', 'dumbbell', 'beginner') },
      ]},
    { id: 's2', label: trainingSessionLabel(1), name: 'Haut du corps', targetMuscles: ['chest', 'lats'], durationMinutes: 70,
      warmup: 'Rotations d’épaules et deux séries légères.', cooldown: '',
      exercises: [
        { id: 'e4', exerciseId: 'a', sets: 4, reps: '8', load: '60 kg', restSeconds: 150, tempo: '', notes: '', exercise: exercise('a', 'Développé couché', 'barbell', 'intermediate') },
        { id: 'e5', exerciseId: 'b', sets: 4, reps: 'max', load: 'poids du corps', restSeconds: 120, tempo: '', notes: '', exercise: exercise('b', 'Tractions', 'body only', 'expert') },
      ]},
  ],
  schedule: [0, null, 1, null, 0, null, null],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

writeFileSync(resolve(outDir, 'muscu.pdf'), await renderPdf(renderTrainingPdf(training, { branding, clientName: 'Julie · Semaine 1' })));
console.log(`${resolve(outDir, 'muscu.pdf')} écrit`);

if (process.argv.includes('--png')) {
  await screenshotPages(renderNutritionPdf(program, { branding, clientName: 'Julie · Semaine 1' }), outDir, 'nutrition');
  await screenshotPages(renderTrainingPdf(training, { branding, clientName: 'Julie · Semaine 1' }), outDir, 'muscu');
  console.log('images écrites');
}

await closePdfRenderer();
