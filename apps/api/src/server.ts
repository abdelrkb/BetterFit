import { buildApp } from './app.js';
import { env } from './env.js';
import { closePdfRenderer } from './pdf/render.js';

const app = await buildApp();

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    // Le Chromium des PDF survivrait au serveur : il faut le fermer aussi.
    void app
      .close()
      .then(() => closePdfRenderer())
      .then(() => process.exit(0));
  });
}
