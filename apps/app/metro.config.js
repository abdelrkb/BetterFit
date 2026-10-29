// Configuration Metro adaptée au monorepo : Metro doit surveiller la racine du
// dépôt (pour `packages/shared`) et chercher les modules dans les deux dossiers
// `node_modules`.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// `packages/shared` est écrit en TypeScript ESM : ses imports internes portent
// l'extension `.js`, ce que Node exige à l'exécution côté API. Metro, lui, ne
// réécrit pas `.js` en `.ts` : on le fait ici.
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -'.js'.length), platform);
    } catch {
      // Ce n'était pas un fichier TypeScript : on laisse la résolution normale répondre.
    }
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
