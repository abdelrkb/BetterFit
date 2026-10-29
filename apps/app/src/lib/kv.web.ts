/**
 * Stockage clé-valeur du web : `localStorage`.
 *
 * Les accès sont protégés : en navigation privée, ou avec les données de site
 * bloquées, `localStorage` lève une exception au lieu de rendre `null`.
 */
export async function readKey(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeKey(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota dépassé ou stockage bloqué : la séance continue en mémoire.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Rien à faire.
  }
}
