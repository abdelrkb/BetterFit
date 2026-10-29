import { randomUUID } from 'node:crypto';
import type { Session } from '@betterfit/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.js';
import { db } from '../src/db/client.js';
import { exercises, programs, weightEntries, workoutLogs } from '../src/db/schema.js';
import { buildSearchText } from '../src/exercises/search-text.js';
import { API, authHeaders, register, startApp } from './helpers.js';

let app: App;
let squatId = '';

beforeAll(async () => {
  app = await startApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  const [row] = await db
    .insert(exercises)
    .values({
      source: 'library',
      externalId: 'Barbell_Squat',
      name: 'Squat à la barre',
      nameEn: 'Barbell Squat',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: [],
      equipment: 'barbell',
      level: 'intermediate',
      category: 'strength',
      instructionsEn: ['Squat.'],
      images: [],
      searchText: buildSearchText({ name: 'Squat à la barre' }),
    })
    .returning({ id: exercises.id });

  squatId = row!.id;
});

/** Un coach avec son espace activé. */
async function registerCoach(): Promise<Session> {
  const coach = await register(app, { email: 'coach@exemple.fr', name: 'Marc' });

  await app.inject({
    method: 'POST',
    url: `${API}/coach/activate`,
    headers: authHeaders(coach),
    payload: { displayName: 'Marc Coaching', contact: 'marc@exemple.fr', accentColor: '#6B3FD9' },
  });

  return coach;
}

/** Relie un coach et un client par un code, et renvoie les deux sessions. */
async function linkCoachAndClient() {
  const coach = await registerCoach();
  const client = await register(app, { email: 'julie@exemple.fr', name: 'Julie' });

  const invitation = await app.inject({
    method: 'POST',
    url: `${API}/coach/invitations`,
    headers: authHeaders(coach),
    payload: { kind: 'code' },
  });

  await app.inject({
    method: 'POST',
    url: `${API}/me/coaching/join`,
    headers: authHeaders(client),
    payload: { code: invitation.json().code },
  });

  return { coach, client };
}

function programInput() {
  return {
    title: 'Modèle débutant',
    isTemplate: true,
    details: {
      goal: 'gain_muscle' as const,
      level: 'beginner' as const,
      place: 'gym' as const,
      sessionMinutes: 60,
      weeks: 8,
      coachNote: 'On y va doucement.',
    },
    sessions: [
      {
        label: '',
        name: 'Jambes',
        targetMuscles: ['quadriceps' as const],
        durationMinutes: 60,
        warmup: 'Vélo 10 min.',
        cooldown: '',
        exercises: [
          {
            exerciseId: squatId,
            sets: 4,
            reps: '8-10',
            load: '60 kg',
            restSeconds: 120,
            tempo: '',
            notes: '',
          },
        ],
      },
    ],
    schedule: [0, null, null, null, 0, null, null],
  };
}

describe('espace coach', () => {
  it('refuse les routes de coach tant que l’espace n’est pas activé', async () => {
    const session = await register(app);

    for (const url of [`${API}/coach/clients`, `${API}/coach/settings`]) {
      const response = await app.inject({ method: 'GET', url, headers: authHeaders(session) });
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('coach/not-activated');
    }
  });

  it('s’active et renvoie ses réglages', async () => {
    const coach = await registerCoach();

    const response = await app.inject({
      method: 'GET',
      url: `${API}/coach/settings`,
      headers: authHeaders(coach),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().displayName).toBe('Marc Coaching');
  });
});

describe('invitation par code', () => {
  it('relie le coach et le client', async () => {
    const { coach, client } = await linkCoachAndClient();

    const clients = await app.inject({
      method: 'GET',
      url: `${API}/coach/clients`,
      headers: authHeaders(coach),
    });
    expect(clients.json().items).toHaveLength(1);
    expect(clients.json().items[0].name).toBe('Julie');

    const mine = await app.inject({
      method: 'GET',
      url: `${API}/me/coaching`,
      headers: authHeaders(client),
    });
    expect(mine.json().coach.displayName).toBe('Marc Coaching');
  });

  it('refuse un code inconnu', async () => {
    const client = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join`,
      headers: authHeaders(client),
      payload: { code: 'ZZZZZZ' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('refuse un code expiré', async () => {
    const coach = await registerCoach();
    const client = await register(app, { email: 'julie@exemple.fr', name: 'Julie' });

    const invitation = await app.inject({
      method: 'POST',
      url: `${API}/coach/invitations`,
      headers: authHeaders(coach),
      payload: { kind: 'code' },
    });

    const { invitations } = await import('../src/db/schema.js');
    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.id, invitation.json().id));

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join`,
      headers: authHeaders(client),
      payload: { code: invitation.json().code },
    });

    expect(response.statusCode).toBe(404);
  });

  it('empêche d’avoir deux coachs à la fois', async () => {
    const { client } = await linkCoachAndClient();

    const second = await register(app, { email: 'paul@exemple.fr', name: 'Paul' });
    await app.inject({
      method: 'POST',
      url: `${API}/coach/activate`,
      headers: authHeaders(second),
      payload: { displayName: 'Paul Coaching', contact: '', accentColor: '#6B3FD9' },
    });

    const invitation = await app.inject({
      method: 'POST',
      url: `${API}/coach/invitations`,
      headers: authHeaders(second),
      payload: { kind: 'code' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join`,
      headers: authHeaders(client),
      payload: { code: invitation.json().code },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe('coach/already-coached');
  });

  it('empêche d’être son propre coach', async () => {
    const coach = await registerCoach();

    const invitation = await app.inject({
      method: 'POST',
      url: `${API}/coach/invitations`,
      headers: authHeaders(coach),
      payload: { kind: 'code' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join`,
      headers: authHeaders(coach),
      payload: { code: invitation.json().code },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('invitation dans l’app', () => {
  it('fait apparaître une proposition que le client accepte', async () => {
    const coach = await registerCoach();
    const client = await register(app, { email: 'julie@exemple.fr', name: 'Julie' });

    const invitation = await app.inject({
      method: 'POST',
      url: `${API}/coach/invitations`,
      headers: authHeaders(coach),
      payload: { kind: 'in_app', email: 'julie@exemple.fr' },
    });
    expect(invitation.statusCode).toBe(201);
    expect(invitation.json().targetName).toBe('Julie');

    const before = await app.inject({
      method: 'GET',
      url: `${API}/me/coaching`,
      headers: authHeaders(client),
    });
    expect(before.json().pending).toHaveLength(1);
    expect(before.json().coach).toBeNull();

    const relationId = before.json().pending[0].relationId;
    const accepted = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/${relationId}/accept`,
      headers: authHeaders(client),
    });
    expect(accepted.statusCode).toBe(204);

    const after = await app.inject({
      method: 'GET',
      url: `${API}/me/coaching`,
      headers: authHeaders(client),
    });
    expect(after.json().coach.displayName).toBe('Marc Coaching');
    expect(after.json().pending).toHaveLength(0);
  });

  it('se refuse, et le coach n’obtient rien', async () => {
    const coach = await registerCoach();
    const client = await register(app, { email: 'julie@exemple.fr', name: 'Julie' });

    await app.inject({
      method: 'POST',
      url: `${API}/coach/invitations`,
      headers: authHeaders(coach),
      payload: { kind: 'in_app', email: 'julie@exemple.fr' },
    });

    const pending = await app.inject({
      method: 'GET',
      url: `${API}/me/coaching`,
      headers: authHeaders(client),
    });

    const declined = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/${pending.json().pending[0].relationId}/decline`,
      headers: authHeaders(client),
    });
    expect(declined.statusCode).toBe(204);

    const clients = await app.inject({
      method: 'GET',
      url: `${API}/coach/clients`,
      headers: authHeaders(coach),
    });
    expect(clients.json().items).toHaveLength(0);
  });

  it('refuse d’inviter une adresse sans compte', async () => {
    const coach = await registerCoach();

    const response = await app.inject({
      method: 'POST',
      url: `${API}/coach/invitations`,
      headers: authHeaders(coach),
      payload: { kind: 'in_app', email: 'personne@exemple.fr' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe('coach/user-not-found');
  });
});

describe('invitation par e-mail', () => {
  it('crée une invitation et ne divulgue jamais le jeton', async () => {
    const coach = await registerCoach();

    const response = await app.inject({
      method: 'POST',
      url: `${API}/coach/invitations`,
      headers: authHeaders(coach),
      payload: { kind: 'email', email: 'nouvelle@exemple.fr' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().email).toBe('nouvelle@exemple.fr');
    expect(response.json().code).toBeNull();
    expect(response.body).not.toContain('token');
  });
});

describe('accès aux données du client', () => {
  it('un coach ne voit que ses clients actifs', async () => {
    const { coach } = await linkCoachAndClient();
    const stranger = await register(app, { email: 'inconnu@exemple.fr', name: 'Inconnu' });

    const response = await app.inject({
      method: 'GET',
      url: `${API}/coach/clients/${stranger.user.id}`,
      headers: authHeaders(coach),
    });

    // Introuvable, pas interdit : on ne révèle pas que le compte existe.
    expect(response.statusCode).toBe(404);
  });

  it('montre séances, programmes et courbe de poids du client', async () => {
    const { coach, client } = await linkCoachAndClient();

    await db.insert(workoutLogs).values({
      id: randomUUID(),
      userId: client.user.id,
      sessionName: 'Jambes',
      startedAt: new Date('2026-10-20T18:00:00.000Z'),
      finishedAt: new Date('2026-10-20T19:00:00.000Z'),
      durationSeconds: 3600,
      totalVolumeKg: 1200,
      completedSets: 8,
    });

    await db.insert(weightEntries).values([
      { userId: client.user.id, date: '2026-10-20', weightKg: 70 },
      { userId: client.user.id, date: '2026-10-21', weightKg: 72 },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: `${API}/coach/clients/${client.user.id}`,
      headers: authHeaders(coach),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workouts).toHaveLength(1);
    expect(response.json().client.workoutsLast28Days).toBeGreaterThanOrEqual(0);
    // La tendance lisse le poids : 70 puis 71, pas 70 puis 72.
    expect(response.json().weights[1].trendKg).toBe(71);
  });

  it('perd l’accès dès que le client met fin au coaching', async () => {
    const { coach, client } = await linkCoachAndClient();

    const mine = await app.inject({
      method: 'GET',
      url: `${API}/me/coaching`,
      headers: authHeaders(client),
    });

    const ended = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/${mine.json().coach.relationId}/end`,
      headers: authHeaders(client),
    });
    expect(ended.statusCode).toBe(204);

    const clients = await app.inject({
      method: 'GET',
      url: `${API}/coach/clients`,
      headers: authHeaders(coach),
    });
    expect(clients.json().items).toHaveLength(0);

    const detail = await app.inject({
      method: 'GET',
      url: `${API}/coach/clients/${client.user.id}`,
      headers: authHeaders(coach),
    });
    expect(detail.statusCode).toBe(404);
  });
});

describe('assignation d’un programme', () => {
  it('crée une copie que le client peut lire', async () => {
    const { coach, client } = await linkCoachAndClient();

    const template = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(coach),
      payload: programInput(),
    });

    const assigned = await app.inject({
      method: 'POST',
      url: `${API}/coach/clients/${client.user.id}/programs`,
      headers: authHeaders(coach),
      payload: { programId: template.json().id, title: 'Programme de Julie' },
    });

    expect(assigned.statusCode).toBe(201);

    const copyId = assigned.json().programId;

    // Le client voit le programme assigné dans sa liste.
    const list = await app.inject({
      method: 'GET',
      url: `${API}/programs`,
      headers: authHeaders(client),
    });
    expect(list.json().items.map((item: { id: string }) => item.id)).toContain(copyId);

    const read = await app.inject({
      method: 'GET',
      url: `${API}/programs/${copyId}`,
      headers: authHeaders(client),
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().title).toBe('Programme de Julie');
    expect(read.json().sessions[0].exercises[0].reps).toBe('8-10');
  });

  it('laisse le modèle intact quand le coach adapte la copie', async () => {
    const { coach, client } = await linkCoachAndClient();

    const template = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(coach),
      payload: programInput(),
    });

    const assigned = await app.inject({
      method: 'POST',
      url: `${API}/coach/clients/${client.user.id}/programs`,
      headers: authHeaders(coach),
      payload: { programId: template.json().id },
    });

    const adapted = programInput();
    adapted.title = 'Version allégée';
    adapted.sessions[0]!.exercises[0]!.sets = 2;

    await app.inject({
      method: 'PUT',
      url: `${API}/programs/${assigned.json().programId}`,
      headers: authHeaders(coach),
      payload: adapted,
    });

    const original = await app.inject({
      method: 'GET',
      url: `${API}/programs/${template.json().id}`,
      headers: authHeaders(coach),
    });
    expect(original.json().title).toBe('Modèle débutant');
    expect(original.json().sessions[0].exercises[0].sets).toBe(4);
  });

  it('le client ne peut pas modifier le programme que son coach lui a assigné', async () => {
    const { coach, client } = await linkCoachAndClient();

    const template = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(coach),
      payload: programInput(),
    });

    const assigned = await app.inject({
      method: 'POST',
      url: `${API}/coach/clients/${client.user.id}/programs`,
      headers: authHeaders(coach),
      payload: { programId: template.json().id },
    });

    const response = await app.inject({
      method: 'PUT',
      url: `${API}/programs/${assigned.json().programId}`,
      headers: authHeaders(client),
      payload: programInput(),
    });

    expect(response.statusCode).toBe(404);
  });

  it('les programmes reçus restent au client après la fin du coaching', async () => {
    const { coach, client } = await linkCoachAndClient();

    const template = await app.inject({
      method: 'POST',
      url: `${API}/programs`,
      headers: authHeaders(coach),
      payload: programInput(),
    });

    const assigned = await app.inject({
      method: 'POST',
      url: `${API}/coach/clients/${client.user.id}/programs`,
      headers: authHeaders(coach),
      payload: { programId: template.json().id },
    });
    const copyId = assigned.json().programId;

    const mine = await app.inject({
      method: 'GET',
      url: `${API}/me/coaching`,
      headers: authHeaders(client),
    });

    await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/${mine.json().coach.relationId}/end`,
      headers: authHeaders(client),
    });

    // Le client garde le programme, et en devient propriétaire.
    const read = await app.inject({
      method: 'GET',
      url: `${API}/programs/${copyId}`,
      headers: authHeaders(client),
    });
    expect(read.statusCode).toBe(200);

    const [row] = await db.select().from(programs).where(eq(programs.id, copyId));
    expect(row?.ownerId).toBe(client.user.id);

    // Le coach, lui, ne l'a plus.
    const coachRead = await app.inject({
      method: 'GET',
      url: `${API}/programs/${copyId}`,
      headers: authHeaders(coach),
    });
    expect(coachRead.statusCode).toBe(404);
  });
});

describe('invitation par lien d’e-mail', () => {
  /** Récupère le jeton en clair depuis le message écrit dans la console. */
  async function inviteByEmail(coach: Session, email: string): Promise<string> {
    const logged: string[] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => logged.push(args.map(String).join(' '));

    try {
      await app.inject({
        method: 'POST',
        url: `${API}/coach/invitations`,
        headers: authHeaders(coach),
        payload: { kind: 'email', email },
      });
    } finally {
      console.info = original;
    }

    const match = /invitation\?token=([A-Za-z0-9_-]+)/.exec(logged.join('\n'));
    if (!match?.[1]) throw new Error('jeton introuvable dans l’e-mail');

    return match[1];
  }

  it('relie les deux comptes quand le lien est ouvert', async () => {
    const coach = await registerCoach();
    const token = await inviteByEmail(coach, 'julie@exemple.fr');

    const client = await register(app, { email: 'julie@exemple.fr', name: 'Julie' });

    const joined = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join-token`,
      headers: authHeaders(client),
      payload: { token },
    });
    expect(joined.statusCode).toBe(204);

    const mine = await app.inject({
      method: 'GET',
      url: `${API}/me/coaching`,
      headers: authHeaders(client),
    });
    expect(mine.json().coach.displayName).toBe('Marc Coaching');
  });

  it('refuse un jeton déjà utilisé', async () => {
    const coach = await registerCoach();
    const token = await inviteByEmail(coach, 'julie@exemple.fr');
    const client = await register(app, { email: 'julie@exemple.fr', name: 'Julie' });

    await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join-token`,
      headers: authHeaders(client),
      payload: { token },
    });

    const second = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join-token`,
      headers: authHeaders(client),
      payload: { token },
    });

    expect(second.statusCode).toBe(404);
  });

  it('refuse un jeton inventé', async () => {
    const client = await register(app);

    const response = await app.inject({
      method: 'POST',
      url: `${API}/me/coaching/join-token`,
      headers: authHeaders(client),
      payload: { token: 'a'.repeat(32) },
    });

    expect(response.statusCode).toBe(404);
  });
});
