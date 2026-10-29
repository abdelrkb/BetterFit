import { spawn } from 'node:child_process';

/**
 * Lance l'API et l'app Expo ensemble.
 *
 * L'ordre compte. L'API parle beaucoup (une ligne par requête) : si elle
 * démarre en même temps qu'Expo, ses journaux font défiler le QR code hors de
 * l'écran avant qu'on ait pu le scanner. On attend donc que l'API écoute,
 * **puis** on lance Expo, dont la sortie reste brute — sinon le QR code
 * serait illisible — et reste la dernière chose affichée.
 */
const children = [];
let shuttingDown = false;

function run(name, args, { prefix }) {
  const child = spawn('pnpm', args, {
    stdio: prefix ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: process.env,
  });

  if (prefix) {
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) process.stdout.write(`[${name}] ${line}\n`);
      });
    }
  }

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`[${name}] arrêté (${signal ?? code}). On arrête tout.`);
      shutdown();
    }
  });

  children.push(child);
  return child;
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 300);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, shutdown);
}

/**
 * Attend que l'API annonce qu'elle écoute. Au-delà du délai on continue
 * quand même : mieux vaut un QR code noyé dans les journaux que pas d'app.
 */
function waitUntilListening(child, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      resolve();
    };

    const timer = setTimeout(done, timeoutMs);
    const onData = (chunk) => {
      if (/listening|3100/i.test(chunk)) done();
    };

    child.stdout.on('data', onData);
  });
}

const api = run('api', ['--filter', '@betterfit/api', 'dev'], { prefix: true });
await waitUntilListening(api);

console.log('\n[api] prête sur http://localhost:3100 — on lance l’app.\n');

run('app', ['--filter', '@betterfit/app', 'dev'], { prefix: false });
