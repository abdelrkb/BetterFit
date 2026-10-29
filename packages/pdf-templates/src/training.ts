import {
  LEVEL_LABELS_FR,
  MUSCLE_LABELS_FR,
  PLACE_LABELS_FR,
  TRAINING_GOAL_LABELS_FR,
  WEEK_DAY_SHORT_FR,
  WEEK_DAYS,
  trainingSessionLabel,
  type Program,
  type WeekDay,
} from '@betterfit/shared';
import { mascotToSvgString } from '@betterfit/mascot/svg';
import { document, page, safeAccent, type Branding } from './document.js';
import { esc } from './styles.js';

/**
 * Le PDF d'un programme de musculation.
 *
 * Une page de garde avec le planning de la semaine, puis **une page par
 * séance** : c'est ce qu'on emporte en salle, et une séance coupée en deux
 * pages serait inutilisable.
 */

export type TrainingPdfPage = 'cover' | 'sessions' | 'basics';

export const TRAINING_PDF_PAGES: readonly TrainingPdfPage[] = ['cover', 'sessions', 'basics'];

export const TRAINING_PAGE_LABELS_FR: Record<TrainingPdfPage, string> = {
  cover: 'Couverture et planning',
  sessions: 'Les séances',
  basics: 'Les bases',
};

function coverPage(program: Program): string {
  const { details } = program;

  const chips = [
    TRAINING_GOAL_LABELS_FR[details.goal],
    LEVEL_LABELS_FR[details.level],
    PLACE_LABELS_FR[details.place],
    `${details.sessionMinutes} min par séance`,
    `${details.weeks} semaines`,
  ];

  return `
<div class="pg-chip">
  <div><span>Séances</span><span class="num">${program.sessions.length}</span></div>
  <div><span>Par semaine</span><span class="num">${program.schedule.filter((day) => day !== null).length}</span></div>
  <div><span>Durée</span><span class="num">${details.weeks} sem.</span></div>
</div>

<div class="pg-card">
  <div class="pg-lab">Ton programme</div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
    ${chips
      .map(
        (chip) =>
          `<span class="pg-soft small" style="padding:6px 12px;font-weight:600">${esc(chip)}</span>`,
      )
      .join('')}
  </div>
</div>

<div class="pg-card">
  <div class="pg-lab">La semaine</div>
  <table style="margin-top:10px">
    <tr><th>Jour</th><th>Séance</th></tr>
    ${WEEK_DAYS.map((day: WeekDay) => {
      const index = program.schedule[day - 1];
      const session = index === null || index === undefined ? null : program.sessions[index];

      return `<tr>
        <td style="width:90px"><b>${esc(WEEK_DAY_SHORT_FR[day])}</b></td>
        <td>${session ? esc(`${trainingSessionLabel(index!)} · ${session.name}`) : '<span class="muted">Repos</span>'}</td>
      </tr>`;
    }).join('')}
  </table>
</div>

${
  program.details.coachNote
    ? `<div class="pg-dark">
  <div class="pg-lab" style="color:#B9A8E6">Le mot du coach</div>
  <p style="margin:8px 0 0">${esc(program.details.coachNote)}</p>
</div>`
    : ''
}`;
}

function sessionPage(program: Program, sessionIndex: number): string {
  const session = program.sessions[sessionIndex]!;

  return `
${
  session.targetMuscles.length > 0
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px">
  ${session.targetMuscles
    .map(
      // Les muscles sont rangés en anglais en base : le document, lui, est
      // en français.
      (muscle) =>
        `<span class="pg-soft small" style="padding:6px 12px;font-weight:600">${esc(MUSCLE_LABELS_FR[muscle])}</span>`,
    )
    .join('')}
</div>`
    : ''
}

${
  session.warmup
    ? `<div class="pg-soft"><b>Échauffement.</b> ${esc(session.warmup)}</div>`
    : ''
}

<div class="pg-card">
  <table>
    <tr>
      <th>Exercice</th>
      <th class="right">Séries</th>
      <th class="right">Reps</th>
      <th class="right">Charge</th>
      <th class="right">Repos</th>
    </tr>
    ${session.exercises
      .map(
        (line) => `<tr>
      <td>
        <b>${esc(line.exercise?.name ?? '')}</b>
        ${line.notes ? `<div class="small muted">${esc(line.notes)}</div>` : ''}
        ${line.tempo ? `<div class="small muted">Tempo ${esc(line.tempo)}</div>` : ''}
      </td>
      <td class="right num">${line.sets}</td>
      <td class="right">${esc(line.reps)}</td>
      <td class="right">${esc(line.load)}</td>
      <td class="right">${line.restSeconds} s</td>
    </tr>`,
      )
      .join('')}
  </table>
</div>

${
  session.cooldown
    ? `<div class="pg-soft"><b>Retour au calme.</b> ${esc(session.cooldown)}</div>`
    : ''
}`;
}

function basicsPage(): string {
  const rules = [
    [
      'La technique avant la charge',
      'Une répétition propre à 40 kg vaut mieux qu’une répétition bâclée à 60. Si la forme se casse, la série est finie.',
    ],
    [
      'Progresse un peu, souvent',
      'Ajoute une répétition ou 2,5 kg quand toutes tes séries passent proprement. C’est lent, et c’est ce qui marche.',
    ],
    [
      'Note tout',
      'Ce que tu as soulevé la dernière fois est la seule façon de savoir si tu progresses. L’app le fait pour toi.',
    ],
    [
      'Le repos fait partie du travail',
      'Le muscle se construit entre les séances, pas pendant. Respecte les jours de repos du planning.',
    ],
  ];

  return `
<div class="pg-card">
  ${rules
    .map(
      ([title, body], index) => `<div style="margin-top:${index === 0 ? 0 : 16}px">
    <h3 style="font-size:16px">${index + 1}. ${esc(title!)}</h3>
    <p style="margin:4px 0 0">${esc(body!)}</p>
  </div>`,
    )
    .join('')}
</div>

<div class="pg-soft" style="display:flex;gap:16px;align-items:center">
  <div style="flex:0 0 96px">${mascotToSvgString('flex', 96)}</div>
  <div>
    <h3 style="font-size:15px">Tu y arriveras</h3>
    <p style="margin:4px 0 0">
      Trois séances par semaine pendant six mois battent six séances par semaine pendant trois
      semaines. La régularité est le seul secret.
    </p>
  </div>
</div>`;
}

export type TrainingPdfOptions = {
  branding: Branding;
  pages?: readonly TrainingPdfPage[];
  clientName?: string;
};

export function renderTrainingPdf(program: Program, options: TrainingPdfOptions): string {
  const accent = safeAccent(options.branding.accent);
  const branding = { ...options.branding, accent };
  const chosen = options.pages ?? TRAINING_PDF_PAGES;
  const who = options.clientName ?? '';

  const bodies: { eyebrow: string; title: string; body: string }[] = [];

  if (chosen.includes('cover')) {
    bodies.push({
      eyebrow: 'Programme musculation',
      title: program.title,
      body: coverPage(program),
    });
  }

  if (chosen.includes('sessions')) {
    // Une page par séance : on n'en coupe jamais une en deux.
    program.sessions.forEach((session, index) => {
      bodies.push({
        eyebrow: `Séance ${trainingSessionLabel(index)}`,
        title: session.name,
        body: sessionPage(program, index),
      });
    });
  }

  if (chosen.includes('basics')) {
    bodies.push({ eyebrow: 'Les bases', title: 'Quatre règles', body: basicsPage() });
  }

  const pages = bodies.map((entry, index) =>
    page({
      eyebrow: entry.eyebrow,
      title: entry.title,
      body: entry.body,
      branding,
      who,
      pageNumber: index + 1,
      pageCount: bodies.length,
    }),
  );

  return document({ title: program.title, accent, pages });
}
