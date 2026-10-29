import { compose, composeFile } from './docker-compose.mjs';

const status = compose(['-f', composeFile, 'up', '-d', '--wait']);

if (status === 0) {
  console.log('PostgreSQL est prêt sur localhost:5434.');
}

process.exit(status);
