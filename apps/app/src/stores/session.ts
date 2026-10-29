import {
  meSchema,
  sessionSchema,
  type LoginInput,
  type Me,
  type OnboardingInput,
  type ProfileUpdate,
  type RegisterInput,
  type Session,
  type UpdateUserInput,
  type User,
} from '@betterfit/shared';
import { create } from 'zustand';
import { apiRequest, ApiRequestError, type RequestOptions } from '../lib/api';
import { readRefreshToken, writeRefreshToken } from '../lib/storage';

/**
 * La session : qui est connecté, et comment on parle à l'API en son nom.
 *
 * Le jeton d'accès ne vit qu'en mémoire — il dure 15 minutes, et le garder sur
 * le disque n'apporterait rien d'autre qu'un risque. Au démarrage, `bootstrap`
 * essaie de le reconstruire à partir du jeton de rafraîchissement.
 */

type Status = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: Status;
  user: User | null;
  profile: Me['profile'];
  latestWeightKg: number | null;
  accessToken: string | null;

  bootstrap: () => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
  /** Met à jour le dernier poids connu, après une pesée saisie dans l'app. */
  setLatestWeightKg: (weightKg: number | null) => void;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  updateProfile: (input: ProfileUpdate) => Promise<void>;
  updateUser: (input: UpdateUserInput) => Promise<void>;
  /** Appel authentifié, qui réessaie une fois si le jeton d'accès a expiré. */
  authedRequest: <T>(
    path: string,
    options?: RequestOptions,
    parse?: (data: unknown) => T,
  ) => Promise<T>;
};

/** `null` sur le web : le jeton y voyage dans un cookie, pas dans le corps. */
async function refreshBody(): Promise<{ refreshToken?: string } | undefined> {
  const token = await readRefreshToken();
  return token ? { refreshToken: token } : undefined;
}

export const useSession = create<SessionState>((set, get) => {
  /** Enregistre une session fraîche et met le jeton de rafraîchissement de côté. */
  async function adopt(session: Session): Promise<void> {
    await writeRefreshToken(session.refreshToken);
    set({ status: 'signedIn', user: session.user, accessToken: session.accessToken });
  }

  function forget(): void {
    set({
      status: 'signedOut',
      user: null,
      profile: null,
      latestWeightKg: null,
      accessToken: null,
    });
  }

  /** Échange le jeton de rafraîchissement contre un jeton d'accès neuf. */
  async function renew(): Promise<string | null> {
    try {
      const session = await apiRequest(
        '/auth/refresh',
        { method: 'POST', body: (await refreshBody()) ?? {} },
        (data) => sessionSchema.parse(data),
      );

      await adopt(session);
      return session.accessToken;
    } catch {
      await writeRefreshToken(null);
      return null;
    }
  }

  return {
    status: 'loading',
    user: null,
    profile: null,
    latestWeightKg: null,
    accessToken: null,

    async authedRequest(path, options = {}, parse) {
      const token = get().accessToken;

      try {
        return await apiRequest(path, { ...options, accessToken: token }, parse);
      } catch (error) {
        // Jeton expiré : on en demande un neuf et on rejoue une seule fois.
        if (!(error instanceof ApiRequestError) || error.status !== 401) throw error;

        const renewed = await renew();
        if (!renewed) {
          forget();
          throw error;
        }

        return apiRequest(path, { ...options, accessToken: renewed }, parse);
      }
    },

    async bootstrap() {
      const token = await renew();

      if (!token) {
        forget();
        return;
      }

      await get().refreshMe();
    },

    async signUp(input) {
      const session = await apiRequest('/auth/register', { method: 'POST', body: input }, (data) =>
        sessionSchema.parse(data),
      );

      await adopt(session);
      await get().refreshMe();
    },

    async signIn(input) {
      const session = await apiRequest('/auth/login', { method: 'POST', body: input }, (data) =>
        sessionSchema.parse(data),
      );

      await adopt(session);
      await get().refreshMe();
    },

    async signOut() {
      try {
        await apiRequest('/auth/logout', { method: 'POST', body: (await refreshBody()) ?? {} });
      } catch {
        // Déconnexion hors ligne : on oublie quand même la session localement.
      }

      await writeRefreshToken(null);
      forget();
    },

    async refreshMe() {
      const me = await get().authedRequest('/me', {}, (data) => meSchema.parse(data));

      set({
        status: 'signedIn',
        user: me.user,
        profile: me.profile,
        latestWeightKg: me.latestWeightKg,
      });
    },

    setLatestWeightKg(weightKg) {
      set({ latestWeightKg: weightKg });
    },

    async completeOnboarding(input) {
      const me = await get().authedRequest(
        '/me/onboarding',
        { method: 'POST', body: input },
        (data) => meSchema.parse(data),
      );

      set({ user: me.user, profile: me.profile, latestWeightKg: me.latestWeightKg });
    },

    async updateProfile(input) {
      const me = await get().authedRequest('/me/profile', { method: 'PUT', body: input }, (data) =>
        meSchema.parse(data),
      );

      set({ user: me.user, profile: me.profile, latestWeightKg: me.latestWeightKg });
    },

    async updateUser(input) {
      await get().authedRequest('/me', { method: 'PATCH', body: input });
      await get().refreshMe();
    },
  };
});
