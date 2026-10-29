import { compose, composeFile } from './docker-compose.mjs';

process.exit(compose(['-f', composeFile, 'down']));
