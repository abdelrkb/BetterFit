import { spawnSync } from 'node:child_process';

/**
 * Lance Docker Compose. Suivant l'installation, la commande est soit
 * `docker compose`, soit l'ancien binaire `docker-compose` : on essaie les deux.
 */
export function compose(args) {
  const candidates = [
    ['docker', ['compose', ...args]],
    ['docker-compose', args],
  ];

  for (const [command, commandArgs] of candidates) {
    const result = spawnSync(command, commandArgs, { stdio: 'inherit' });

    if (result.error?.code === 'ENOENT') continue;
    if (result.status === null) continue;
    // `docker compose` renvoie 125 quand le sous-commande n'existe pas.
    if (result.status === 125) continue;

    return result.status;
  }

  console.error('Docker est introuvable. Installe Docker Desktop, puis relance la commande.');
  return 1;
}

export const composeFile = new URL('../infra/docker-compose.dev.yml', import.meta.url).pathname;
