import {
  API_PREFIX,
  apiErrorSchema,
  healthResponseSchema,
  type ApiError,
  type HealthResponse,
} from '@betterfit/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Adresse de l'API. En développement, on déduit l'IP de la machine depuis celle
 * du serveur Metro : c'est ce qui permet au téléphone d'atteindre l'API sur le
 * réseau local sans rien configurer à la main.
 */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? Constants.expoConfig?.extra?.apiUrl;
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') {
    return `http://${host}:3100`;
  }

  return 'http://localhost:3100';
}

export const apiBaseUrl = resolveApiBaseUrl();

/** L'app annonce sa plateforme : l'API choisit cookie (web) ou corps (mobile). */
const clientPlatform = Platform.OS === 'web' ? 'web' : 'native';

/** Erreur renvoyée par l'API, avec son code stable et ses erreurs par champ. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Erreur réseau : serveur éteint, pas de connexion, mauvaise adresse. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Serveur injoignable.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
};

/**
 * Un appel à l'API. Ne gère pas le rafraîchissement : c'est le rôle du store
 * de session, qui est le seul à savoir réessayer.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  parse?: (data: unknown) => T,
): Promise<T> {
  const { method = 'GET', body, accessToken, signal } = options;

  const headers: Record<string, string> = { 'x-client-platform': clientPlatform };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // Indispensable sur le web : sans ça le cookie de session ne circule pas.
      credentials: 'include',
      signal,
    });
  } catch (error) {
    throw new NetworkError(error);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: unknown = text.length > 0 ? JSON.parse(text) : null;

  if (!response.ok) {
    throw toApiError(response.status, data);
  }

  return parse ? parse(data) : (data as T);
}

function toApiError(status: number, data: unknown): ApiRequestError {
  const parsed = apiErrorSchema.safeParse(data);

  if (parsed.success) {
    const error: ApiError = parsed.data;
    return new ApiRequestError(status, error.code, error.message, error.fields);
  }

  return new ApiRequestError(status, 'server/error', `Erreur ${status}.`);
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiRequest('/health', {}, (data) => healthResponseSchema.parse(data));
}
