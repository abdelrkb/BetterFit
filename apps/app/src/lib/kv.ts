import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Stockage clé-valeur local, pour la séance en cours et la file d'envoi.
 *
 * Sur téléphone, `AsyncStorage`. Sur le web, `kv.web.ts` prend le relais avec
 * `localStorage` : la version web d'`AsyncStorage` ne se charge pas dans ce
 * projet, et un fichier par plateforme est de toute façon plus clair qu'une
 * couche de compatibilité.
 */
export async function readKey(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeKey(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Stockage plein ou indisponible : on continue en mémoire.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Rien à faire.
  }
}
