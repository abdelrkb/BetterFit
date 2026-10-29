import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** Comptes. Un seul type de compte : les rôles dépendent du contexte. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Toujours stocké en minuscules : l'unicité ne doit pas dépendre de la casse. */
    email: text('email').notNull(),
    /** `null` pour un compte créé uniquement via Google ou Apple. */
    passwordHash: text('password_hash'),
    name: text('name').notNull(),
    locale: text('locale').notNull().default('fr'),
    /**
     * Droit de corriger les traductions de la bibliothèque partagée. Réservé
     * au porteur du projet : ces textes sont vus par tout le monde.
     */
    canEditLibrary: boolean('can_edit_library').notNull().default(false),
    /**
     * Date du consentement explicite au traitement des données de santé.
     * `null` tant qu'il n'a pas été donné (RGPD : il doit être traçable).
     */
    healthDataConsentAt: timestamp('health_data_consent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

/** Connexions par un fournisseur tiers. Vide tant que Google et Apple ne sont pas activés. */
export const authProvider = pgEnum('auth_provider', ['google', 'apple']);

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authProvider('provider').notNull(),
    /** L'identifiant stable donné par le fournisseur (`sub` chez Google et Apple). */
    providerUserId: text('provider_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('auth_identities_provider_user_unique').on(table.provider, table.providerUserId),
    index('auth_identities_user_idx').on(table.userId),
  ],
);

/**
 * Sessions. Une ligne par appareil connecté.
 *
 * Le jeton de rafraîchissement n'est **jamais** stocké en clair : seule son
 * empreinte SHA-256 est en base, comme pour un mot de passe. `rotatedTo` garde
 * la trace de la rotation : si un ancien jeton ressert, c'est qu'il a fuité, et
 * on révoque toute la lignée.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    /** Agrège les jetons issus d'une même connexion, pour tout révoquer d'un coup. */
    sessionId: uuid('session_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    rotatedTo: uuid('rotated_to'),
    /** Pour que l'utilisateur reconnaisse ses appareils dans ses réglages. */
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('refresh_tokens_hash_unique').on(table.tokenHash),
    index('refresh_tokens_user_idx').on(table.userId),
    index('refresh_tokens_session_idx').on(table.sessionId),
  ],
);

/** Liens de réinitialisation de mot de passe. Même principe : seule l'empreinte est stockée. */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_hash_unique').on(table.tokenHash),
    index('password_reset_tokens_user_idx').on(table.userId),
  ],
);

export const sex = pgEnum('sex', ['female', 'male']);
export const activityLevel = pgEnum('activity_level', [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
]);
export const goal = pgEnum('goal', ['lose_fat', 'maintain', 'gain_muscle']);

/** Le profil : ce qui ne change pas tous les jours, et qui alimente les calculs. */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  sex: sex('sex').notNull(),
  birthDate: date('birth_date').notNull(),
  heightCm: smallint('height_cm').notNull(),
  activityLevel: activityLevel('activity_level').notNull(),
  goal: goal('goal').notNull(),
  weeklySessions: smallint('weekly_sessions').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Suivi du poids : une mesure par jour et par personne.
 *
 * Créée ici parce que l'onboarding demande déjà un premier poids. L'écran de
 * suivi et la moyenne glissante viennent à l'étape 9.
 */
export const weightEntries = pgTable(
  'weight_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    weightKg: real('weight_kg').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('weight_entries_user_date_unique').on(table.userId, table.date),
    index('weight_entries_user_idx').on(table.userId),
  ],
);

/**
 * Compteur de tentatives, pour freiner les attaques par force brute sur la
 * connexion et sur le mot de passe oublié. En base plutôt qu'en mémoire : le
 * compte doit survivre à un redémarrage de l'API.
 */
export const authAttempts = pgTable(
  'auth_attempts',
  {
    /** Ce qu'on compte : une adresse e-mail, ou une IP. */
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    /** Début de la fenêtre glissante. */
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Tant que cette date est dans le futur, les tentatives sont refusées. */
    blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  },
  (table) => [index('auth_attempts_blocked_idx').on(table.blockedUntil)],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  identities: many(authIdentities),
  refreshTokens: many(refreshTokens),
  weightEntries: many(weightEntries),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, { fields: [authIdentities.userId], references: [users.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const weightEntriesRelations = relations(weightEntries, ({ one }) => ({
  user: one(users, { fields: [weightEntries.userId], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

export const exerciseSource = pgEnum('exercise_source', ['library', 'custom']);
export const exerciseEquipment = pgEnum('exercise_equipment', [
  'barbell',
  'dumbbell',
  'kettlebells',
  'cable',
  'machine',
  'body only',
  'bands',
  'medicine ball',
  'exercise ball',
  'foam roll',
  'e-z curl bar',
  'other',
]);
export const exerciseLevel = pgEnum('exercise_level', ['beginner', 'intermediate', 'expert']);
export const exerciseCategory = pgEnum('exercise_category', [
  'strength',
  'stretching',
  'plyometrics',
  'powerlifting',
  'olympic weightlifting',
  'strongman',
  'cardio',
]);
export const exerciseForce = pgEnum('exercise_force', ['push', 'pull', 'static']);
export const exerciseMechanic = pgEnum('exercise_mechanic', ['compound', 'isolation']);

/**
 * La bibliothèque d'exercices : les 873 de free-exercise-db (`library`) et
 * ceux que les utilisateurs créent (`custom`).
 *
 * `searchText` concentre tout ce sur quoi on cherche (nom français, nom
 * anglais, muscles), sans accents : c'est la colonne indexée en trigrammes.
 */
export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: exerciseSource('source').notNull(),
    /** `null` pour la bibliothèque partagée, sinon le créateur. */
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    /** Identifiant d'origine dans free-exercise-db : rend l'import rejouable. */
    externalId: text('external_id'),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    primaryMuscles: text('primary_muscles').array().notNull().default([]),
    secondaryMuscles: text('secondary_muscles').array().notNull().default([]),
    equipment: exerciseEquipment('equipment').notNull(),
    level: exerciseLevel('level').notNull(),
    category: exerciseCategory('category').notNull(),
    force: exerciseForce('force'),
    mechanic: exerciseMechanic('mechanic'),
    instructions: text('instructions').array().notNull().default([]),
    instructionsEn: text('instructions_en').array().notNull().default([]),
    images: text('images').array().notNull().default([]),
    mascotPose: text('mascot_pose'),
    searchText: text('search_text').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('exercises_external_unique').on(table.externalId),
    index('exercises_owner_idx').on(table.ownerId),
    index('exercises_source_idx').on(table.source),
  ],
);

export const exercisesRelations = relations(exercises, ({ one }) => ({
  owner: one(users, { fields: [exercises.ownerId], references: [users.id] }),
}));

export type ExerciseRow = typeof exercises.$inferSelect;

export const programKind = pgEnum('program_kind', ['training', 'nutrition']);
export const programPlace = pgEnum('program_place', ['gym', 'home', 'outdoor', 'mixed']);
export const trainingGoal = pgEnum('training_goal', [
  'lose_fat',
  'gain_muscle',
  'strength',
  'endurance',
  'general',
]);

/**
 * Un programme, de musculation ou de nutrition.
 *
 * `sourceProgramId` et `assignedToUserId` servent à l'assignation (étape 6) :
 * assigner, c'est **copier** le programme pour le client, afin que le coach
 * puisse l'adapter sans toucher au modèle d'origine.
 */
export const programs = pgTable(
  'programs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: programKind('kind').notNull(),
    title: text('title').notNull(),
    isTemplate: boolean('is_template').notNull().default(false),
    sourceProgramId: uuid('source_program_id'),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('programs_owner_idx').on(table.ownerId),
    index('programs_assigned_idx').on(table.assignedToUserId),
  ],
);

/** Les réglages propres à un programme de musculation. */
export const trainingDetails = pgTable('training_details', {
  programId: uuid('program_id')
    .primaryKey()
    .references(() => programs.id, { onDelete: 'cascade' }),
  goal: trainingGoal('goal').notNull().default('general'),
  level: exerciseLevel('level').notNull().default('beginner'),
  place: programPlace('place').notNull().default('gym'),
  sessionMinutes: smallint('session_minutes').notNull().default(60),
  weeks: smallint('weeks').notNull().default(8),
  coachNote: text('coach_note').notNull().default(''),
});

/** Une séance du programme : A, B, C… */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
    targetMuscles: text('target_muscles').array().notNull().default([]),
    durationMinutes: smallint('duration_minutes').notNull().default(60),
    warmup: text('warmup').notNull().default(''),
    cooldown: text('cooldown').notNull().default(''),
  },
  (table) => [index('sessions_program_idx').on(table.programId)],
);

/** Un exercice dans une séance, avec ses consignes de travail. */
export const sessionExercises = pgTable(
  'session_exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: smallint('position').notNull(),
    sets: smallint('sets').notNull().default(3),
    reps: text('reps').notNull().default(''),
    load: text('load').notNull().default(''),
    restSeconds: smallint('rest_seconds').notNull().default(90),
    tempo: text('tempo').notNull().default(''),
    notes: text('notes').notNull().default(''),
  },
  (table) => [index('session_exercises_session_idx').on(table.sessionId)],
);

/** Le planning hebdomadaire : une ligne par jour travaillé. */
export const weeklySchedule = pgTable(
  'weekly_schedule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    /** Lundi = 1, dimanche = 7. */
    dayOfWeek: smallint('day_of_week').notNull(),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('weekly_schedule_program_day_unique').on(table.programId, table.dayOfWeek),
  ],
);

export const programsRelations = relations(programs, ({ one, many }) => ({
  owner: one(users, { fields: [programs.ownerId], references: [users.id] }),
  details: one(trainingDetails, {
    fields: [programs.id],
    references: [trainingDetails.programId],
  }),
  sessions: many(sessions),
  schedule: many(weeklySchedule),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  program: one(programs, { fields: [sessions.programId], references: [programs.id] }),
  exercises: many(sessionExercises),
}));

export const sessionExercisesRelations = relations(sessionExercises, ({ one }) => ({
  session: one(sessions, { fields: [sessionExercises.sessionId], references: [sessions.id] }),
  exercise: one(exercises, { fields: [sessionExercises.exerciseId], references: [exercises.id] }),
}));

export type ProgramRow = typeof programs.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionExerciseRow = typeof sessionExercises.$inferSelect;

/**
 * Une séance réalisée.
 *
 * L'identifiant vient de l'appareil : la séance est construite hors ligne, et
 * l'envoi peut être rejoué sans créer de doublon (`onConflictDoUpdate`).
 * `sessionName` fige le nom au moment de la séance, pour que l'historique
 * reste lisible même si le programme est supprimé ensuite.
 */
export const workoutLogs = pgTable(
  'workout_logs',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    programId: uuid('program_id').references(() => programs.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    sessionName: text('session_name').notNull().default(''),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    totalVolumeKg: real('total_volume_kg').notNull().default(0),
    completedSets: smallint('completed_sets').notNull().default(0),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workout_logs_user_idx').on(table.userId),
    index('workout_logs_finished_idx').on(table.userId, table.finishedAt),
  ],
);

/** Une série saisie pendant la séance. */
export const setLogs = pgTable(
  'set_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workoutLogId: uuid('workout_log_id')
      .notNull()
      .references(() => workoutLogs.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    /** Rang de l'exercice dans la séance. */
    position: smallint('position').notNull().default(0),
    /** Numéro de la série dans l'exercice, à partir de 1. */
    setIndex: smallint('set_index').notNull(),
    weightKg: real('weight_kg'),
    reps: smallint('reps'),
    rir: smallint('rir'),
    done: boolean('done').notNull().default(false),
  },
  (table) => [
    index('set_logs_workout_idx').on(table.workoutLogId),
    index('set_logs_exercise_idx').on(table.exerciseId),
  ],
);

export const workoutLogsRelations = relations(workoutLogs, ({ one, many }) => ({
  user: one(users, { fields: [workoutLogs.userId], references: [users.id] }),
  sets: many(setLogs),
}));

export const setLogsRelations = relations(setLogs, ({ one }) => ({
  workout: one(workoutLogs, { fields: [setLogs.workoutLogId], references: [workoutLogs.id] }),
  exercise: one(exercises, { fields: [setLogs.exerciseId], references: [exercises.id] }),
}));

export type WorkoutLogRow = typeof workoutLogs.$inferSelect;
export type SetLogRow = typeof setLogs.$inferSelect;

export const relationStatus = pgEnum('relation_status', ['pending', 'active', 'ended']);
export const invitationKind = pgEnum('invitation_kind', ['email', 'code', 'in_app']);
export const invitationStatus = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
  'cancelled',
]);

/** Les réglages de l'espace coach. Leur existence fait de quelqu'un un coach. */
export const coachSettings = pgTable('coach_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  contact: text('contact').notNull().default(''),
  accentColor: text('accent_color').notNull().default('#6B3FD9'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * La relation entre un coach et un client.
 *
 * Un client n'a qu'un **seul coach actif** en V1 : l'index partiel plus bas
 * l'impose en base, et pas seulement dans le code.
 */
export const coachingRelations = pgTable(
  'coaching_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: relationStatus('status').notNull().default('pending'),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('coaching_relations_coach_idx').on(table.coachId),
    index('coaching_relations_client_idx').on(table.clientId),
    uniqueIndex('coaching_relations_pair_unique').on(table.coachId, table.clientId),
  ],
);

/**
 * Une invitation : par e-mail, par code, ou directement dans l'app.
 *
 * Le jeton d'un lien d'e-mail n'est jamais stocké en clair, comme pour les
 * mots de passe. Le code court, lui, doit rester lisible : c'est le coach qui
 * le dicte à son client.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: invitationKind('kind').notNull(),
    email: text('email'),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
    code: text('code'),
    tokenHash: text('token_hash'),
    status: invitationStatus('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('invitations_coach_idx').on(table.coachId),
    index('invitations_target_idx').on(table.targetUserId),
    uniqueIndex('invitations_code_unique').on(table.code),
    uniqueIndex('invitations_token_unique').on(table.tokenHash),
  ],
);

export const coachSettingsRelations = relations(coachSettings, ({ one }) => ({
  user: one(users, { fields: [coachSettings.userId], references: [users.id] }),
}));

export const coachingRelationsRelations = relations(coachingRelations, ({ one }) => ({
  coach: one(users, { fields: [coachingRelations.coachId], references: [users.id] }),
  client: one(users, { fields: [coachingRelations.clientId], references: [users.id] }),
}));

export type CoachingRelationRow = typeof coachingRelations.$inferSelect;
export type InvitationRow = typeof invitations.$inferSelect;

/* ------------------------------------------------------------------ */
/* Nutrition (étape 7)                                                  */
/* ------------------------------------------------------------------ */

/**
 * Les réglages d'un programme de nutrition.
 *
 * Le sexe, l'âge, le poids et la taille y sont **recopiés**, pas lus dans le
 * profil : le programme doit rester fidèle aux chiffres sur lesquels le coach
 * l'a construit. Sinon, une pesée du lendemain changerait rétroactivement les
 * cibles d'un programme déjà imprimé.
 */
export const nutritionDetails = pgTable('nutrition_details', {
  programId: uuid('program_id')
    .primaryKey()
    .references(() => programs.id, { onDelete: 'cascade' }),

  sex: sex('sex').notNull(),
  age: smallint('age').notNull(),
  weightKg: real('weight_kg').notNull(),
  heightCm: smallint('height_cm').notNull(),
  activityLevel: activityLevel('activity_level').notNull(),

  /** Écart au maintien, en kcal. Positif = déficit, négatif = surplus. */
  deficitKcal: integer('deficit_kcal').notNull().default(400),
  proteinGPerKg: real('protein_g_per_kg').notNull().default(2),
  fatGPerKg: real('fat_g_per_kg').notNull().default(0.9),
  fiberG: smallint('fiber_g').notNull().default(30),
  /** Hydratation imposée. `null` : calculée à 35 ml par kilo. */
  waterLiters: real('water_liters'),

  goalTitle: text('goal_title').notNull().default(''),
  goalText: text('goal_text').notNull().default(''),
  preferred: text('preferred').array().notNull().default([]),
  limited: text('limited').array().notNull().default([]),
  coachNote: text('coach_note').notNull().default(''),

  /** Nombre de jours que couvre la liste de courses. */
  shoppingDays: smallint('shopping_days').notNull().default(7),
  budgetCents: integer('budget_cents'),
});

/** Un repas de la journée type. */
export const meals = pgTable(
  'meals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
    /** Heure indicative, texte libre : « 07h30 », « au réveil ». */
    time: text('time').notNull().default(''),
    /**
     * Calories annoncées pour le repas, saisies à la main comme dans le
     * prototype. `null` : on additionne les lignes.
     */
    kcalOverride: integer('kcal_override'),
  },
  (table) => [index('meals_program_idx').on(table.programId)],
);

/**
 * Une ligne d'un repas.
 *
 * Deux modes de saisie, ligne par ligne : un aliment de la base avec une
 * quantité en grammes (macros calculées, étape 8), ou du texte libre avec les
 * valeurs à la main. `foodId` reste `null` dans le second cas.
 */
export const mealItems = pgTable(
  'meal_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mealId: uuid('meal_id')
      .notNull()
      .references(() => meals.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    /**
     * L'aliment de la base, quand la ligne en cite un : les macros sont alors
     * calculées depuis lui. `null` pour une ligne en texte libre.
     * `set null` à la suppression : si quelqu'un efface son aliment perso, la
     * ligne du programme reste, avec son libellé et ses valeurs figées.
     */
    foodId: uuid('food_id').references(() => foods.id, { onDelete: 'set null' }),
    label: text('label').notNull().default(''),
    /** Quantité en texte libre : « 160 g », « 2 œufs », « à volonté ». */
    quantity: text('quantity').notNull().default(''),
    /** Quantité en grammes, quand elle est chiffrable : sert aux calculs. */
    quantityG: real('quantity_g'),
    alternative: text('alternative').notNull().default(''),
    kcal: integer('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
  },
  (table) => [index('meal_items_meal_idx').on(table.mealId)],
);

/** Un rayon de la liste de courses. */
export const shoppingCategories = pgTable(
  'shopping_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    name: text('name').notNull(),
  },
  (table) => [index('shopping_categories_program_idx').on(table.programId)],
);

/**
 * Un article de la liste de courses.
 *
 * `checked` appartient au client : c'est lui qui coche en faisant ses courses,
 * même sur un programme que son coach lui a assigné.
 */
export const shoppingItems = pgTable(
  'shopping_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => shoppingCategories.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    label: text('label').notNull().default(''),
    quantity: text('quantity').notNull().default(''),
    checked: boolean('checked').notNull().default(false),
    /** Prix retenu pour cet article, en centimes. */
    priceCents: integer('price_cents'),
    /** Enseigne où ce prix a été relevé. */
    store: text('store').notNull().default(''),
  },
  (table) => [index('shopping_items_category_idx').on(table.categoryId)],
);

/**
 * Un prix mémorisé, pour ne pas le ressaisir à chaque liste.
 *
 * La clé est le libellé **normalisé** de l'article (sans accents, en
 * minuscules) et l'enseigne. Les prix venus d'Open Prices sont marqués
 * `source = 'open_prices'`, ceux saisis à la main `source = 'manual'`.
 */
export const foodPrices = pgTable(
  'food_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** `null` pour un prix partagé (Open Prices), sinon le propriétaire. */
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    store: text('store').notNull().default(''),
    priceCents: integer('price_cents').notNull(),
    /** Quantité à laquelle ce prix correspond : « le kilo », « la boîte ». */
    unit: text('unit').notNull().default(''),
    source: text('source').notNull().default('manual'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('food_prices_owner_label_store_unique').on(table.ownerId, table.label, table.store),
    index('food_prices_label_idx').on(table.label),
  ],
);

/** Une recette, réutilisable d'un programme à l'autre. */
export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Moment conseillé : « Déjeuner », « Collation »… texte libre. */
    category: text('category').notNull().default(''),
    prepMinutes: smallint('prep_minutes'),
    cookMinutes: smallint('cook_minutes'),
    servings: smallint('servings').notNull().default(1),
    /** Valeurs **par portion**. */
    kcal: integer('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),
    /** Chemin du fichier sur le disque de l'API, jamais une URL publique. */
    photoPath: text('photo_path'),
    tip: text('tip').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('recipes_owner_idx').on(table.ownerId)],
);

export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    foodId: uuid('food_id').references(() => foods.id, { onDelete: 'set null' }),
    label: text('label').notNull().default(''),
    quantity: text('quantity').notNull().default(''),
    quantityG: real('quantity_g'),
  },
  (table) => [index('recipe_ingredients_recipe_idx').on(table.recipeId)],
);

export const recipeSteps = pgTable(
  'recipe_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    text: text('text').notNull().default(''),
  },
  (table) => [index('recipe_steps_recipe_idx').on(table.recipeId)],
);

/** Les recettes jointes à un programme de nutrition. */
export const programRecipes = pgTable(
  'program_recipes',
  {
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id, { onDelete: 'cascade' }),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
  },
  (table) => [
    uniqueIndex('program_recipes_unique').on(table.programId, table.recipeId),
    index('program_recipes_program_idx').on(table.programId),
  ],
);

export const nutritionDetailsRelations = relations(nutritionDetails, ({ one }) => ({
  program: one(programs, { fields: [nutritionDetails.programId], references: [programs.id] }),
}));

export const mealsRelations = relations(meals, ({ one, many }) => ({
  program: one(programs, { fields: [meals.programId], references: [programs.id] }),
  items: many(mealItems),
}));

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
}));

export const shoppingCategoriesRelations = relations(shoppingCategories, ({ one, many }) => ({
  program: one(programs, { fields: [shoppingCategories.programId], references: [programs.id] }),
  items: many(shoppingItems),
}));

export const shoppingItemsRelations = relations(shoppingItems, ({ one }) => ({
  category: one(shoppingCategories, {
    fields: [shoppingItems.categoryId],
    references: [shoppingCategories.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  owner: one(users, { fields: [recipes.ownerId], references: [users.id] }),
  ingredients: many(recipeIngredients),
  steps: many(recipeSteps),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeIngredients.recipeId], references: [recipes.id] }),
}));

export const recipeStepsRelations = relations(recipeSteps, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeSteps.recipeId], references: [recipes.id] }),
}));

export type NutritionDetailsRow = typeof nutritionDetails.$inferSelect;
export type MealRow = typeof meals.$inferSelect;
export type MealItemRow = typeof mealItems.$inferSelect;
export type ShoppingCategoryRow = typeof shoppingCategories.$inferSelect;
export type ShoppingItemRow = typeof shoppingItems.$inferSelect;
export type RecipeRow = typeof recipes.$inferSelect;

/* ------------------------------------------------------------------ */
/* Base d'aliments (étape 8)                                            */
/* ------------------------------------------------------------------ */

/**
 * D'où vient un aliment.
 *
 * `ciqual` : la table de l'ANSES, des aliments génériques (« Riz blanc cuit »).
 * `off` : un produit de marque lu par code-barres sur Open Food Facts, mis en
 * cache chez nous pour ne pas réinterroger leur serveur à chaque fois.
 * `custom` : un aliment créé par quelqu'un, visible de lui seul.
 */
export const foodSource = pgEnum('food_source', ['ciqual', 'off', 'custom']);

/**
 * Un aliment, avec ses valeurs **pour 100 g**.
 *
 * Toujours pour 100 g, quelle que soit la source : c'est la seule façon de
 * mélanger Ciqual, Open Food Facts et les aliments perso dans un même calcul.
 * La portion usuelle est à côté, en information.
 */
export const foods = pgTable(
  'foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: foodSource('source').notNull(),
    /** `null` pour les aliments partagés, sinon le créateur. */
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    /** Code Ciqual, ou code-barres : rend l'import rejouable. */
    externalId: text('external_id'),
    /** Code-barres, quand on en a un. Sert à retrouver un produit scanné. */
    barcode: text('barcode'),

    name: text('name').notNull(),
    brand: text('brand').notNull().default(''),
    category: text('category').notNull().default(''),

    /** Valeurs pour 100 g. `null` quand la source ne les donne pas. */
    kcal: real('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    sugarsG: real('sugars_g'),
    fatG: real('fat_g'),
    saturatedFatG: real('saturated_fat_g'),
    fiberG: real('fiber_g'),
    saltG: real('salt_g'),

    /** Portion usuelle : « une tranche », « un bol ». */
    servingLabel: text('serving_label').notNull().default(''),
    servingG: real('serving_g'),

    /** Nom et marque sans accents, en minuscules : la colonne indexée. */
    searchText: text('search_text').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('foods_source_external_unique').on(table.source, table.externalId),
    index('foods_owner_idx').on(table.ownerId),
    index('foods_barcode_idx').on(table.barcode),
  ],
);

export const foodsRelations = relations(foods, ({ one }) => ({
  owner: one(users, { fields: [foods.ownerId], references: [users.id] }),
}));

export type FoodRow = typeof foods.$inferSelect;

/* ------------------------------------------------------------------ */
/* Journal alimentaire (étape 9)                                        */
/* ------------------------------------------------------------------ */

/** Les quatre moments de la journée. */
export const mealSlot = pgEnum('meal_slot', ['breakfast', 'lunch', 'dinner', 'snack']);

/**
 * Une ligne du journal : ce qu'on a mangé, quel jour, à quel moment.
 *
 * Les valeurs nutritionnelles sont **figées** à la saisie, recopiées depuis
 * l'aliment. Si quelqu'un corrige ensuite son aliment perso, ou si une
 * nouvelle table Ciqual change un chiffre, les journées déjà passées ne
 * doivent pas bouger : on ne réécrit pas l'histoire de ce que quelqu'un a
 * mangé. `foodId` ne sert donc qu'à retrouver l'aliment, jamais à recalculer.
 */
export const foodLogs = pgTable(
  'food_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    slot: mealSlot('slot').notNull(),
    position: smallint('position').notNull().default(0),

    /** L'aliment d'origine, s'il vient de la base. `null` en saisie rapide. */
    foodId: uuid('food_id').references(() => foods.id, { onDelete: 'set null' }),
    label: text('label').notNull(),
    quantityG: real('quantity_g'),
    /** Ce qu'on a tapé : « 160 g », « une barre ». */
    quantityText: text('quantity_text').notNull().default(''),

    /** Valeurs figées, pour la quantité mangée (pas pour 100 g). */
    kcal: real('kcal'),
    proteinG: real('protein_g'),
    carbsG: real('carbs_g'),
    fatG: real('fat_g'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('food_logs_user_date_idx').on(table.userId, table.date),
    index('food_logs_user_food_idx').on(table.userId, table.foodId),
  ],
);

/** Les aliments mis en favori, pour les retrouver en un geste. */
export const foodFavorites = pgTable(
  'food_favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('food_favorites_unique').on(table.userId, table.foodId),
    index('food_favorites_user_idx').on(table.userId),
  ],
);

export const foodLogsRelations = relations(foodLogs, ({ one }) => ({
  user: one(users, { fields: [foodLogs.userId], references: [users.id] }),
  food: one(foods, { fields: [foodLogs.foodId], references: [foods.id] }),
}));

export type FoodLogRow = typeof foodLogs.$inferSelect;
