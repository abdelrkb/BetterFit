import { spawn } from 'node:child_process';

/**
 * Lance l'API et l'app Expo ensemble.
 *
 * L'API écrit dans un flux préfixé « api » ; Expo garde la sortie brute du
 * terminal, sinon le QR code à scanner avec le téléphone serait illisible.
 */
const children = [];

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
}

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 300);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, shutdown);
}

run('api', ['--filter', '@betterfit/api', 'dev'], { prefix: true });
run('app', ['--filter', '@betterfit/app', 'dev'], { prefix: false });
