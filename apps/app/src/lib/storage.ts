import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Où vit le jeton de rafraîchissement.
 *
 * Sur téléphone : dans le trousseau du système (`expo-secure-store`), chiffré.
 * Sur le web : nulle part côté JavaScript — l'API le pose dans un cookie
 * `httpOnly`, que le navigateur renvoie tout seul et qu'un script malveillant
 * ne peut pas lire.
 */

const REFRESH_TOKEN_KEY = 'betterfit.refreshToken';

export const storesRefreshToken = Platform.OS !== 'web';

export async function readRefreshToken(): Promise<string | null> {
  if (!storesRefreshToken) return null;

  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // Trousseau indisponible : on se contente de redemander la connexion.
    return null;
  }
}

export async function writeRefreshToken(token: string | null): Promise<void> {
  if (!storesRefreshToken) return;

  try {
    if (token === null) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } else {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    }
  } catch {
    // Rien à faire : au pire l'utilisateur devra se reconnecter.
  }
}
