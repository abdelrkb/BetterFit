import argon2 from 'argon2';

/**
 * Paramètres argon2id. Les valeurs suivent les recommandations OWASP :
 * 19 Mio de mémoire, 2 passes, parallélisme 1. Le coût est volontairement
 * sensible — c'est ce qui rend une attaque par dictionnaire inintéressante.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Empreinte illisible ou corrompue : on refuse, sans faire tomber la route.
    return false;
  }
}

/**
 * Empreinte fictive, utilisée quand l'adresse n'existe pas.
 *
 * Sans elle, une connexion avec une adresse inconnue répondrait beaucoup plus
 * vite qu'avec une adresse connue, ce qui permettrait de deviner qui a un
 * compte. On vérifie donc toujours un mot de passe, même pour rien.
 */
let decoyHash: Promise<string> | null = null;

export async function wastePasswordTime(password: string): Promise<void> {
  decoyHash ??= hashPassword('mot-de-passe-qui-n-existe-pas');
  await verifyPassword(await decoyHash, password);
}
