import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'module.json',
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'src/main.js',
  'src/apps/RNKReserves.js',
  'src/apps/LogViewer.js',
  'styles/rnk-reserves.css',
  'styles/log-viewer.css',
  'templates/settings.html',
  'templates/log-viewer.hbs',
  'languages/en.json'
];

for (const relativePath of requiredFiles) {
  const fullPath = path.join(root, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

const moduleJson = JSON.parse(readFileSync(path.join(root, 'module.json'), 'utf8'));
const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

if (moduleJson.version !== packageJson.version) {
  throw new Error(`Version mismatch: module.json=${moduleJson.version}, package.json=${packageJson.version}`);
}

if (moduleJson.protected !== false) {
  throw new Error('Patreon-gated premium modules must use protected: false.');
}

if (moduleJson.compatibility?.minimum !== 13 || moduleJson.compatibility?.verified !== 13) {
  throw new Error('module.json compatibility must be numeric and pinned to Foundry 13.');
}

if (!Array.isArray(moduleJson.styles) || moduleJson.styles.length === 0) {
  throw new Error('module.json must declare at least one stylesheet.');
}

if (!Array.isArray(moduleJson.languages) || moduleJson.languages.length === 0) {
  throw new Error('module.json must declare at least one language entry.');
}

const blockedTerms = ['AI', 'assistant'];
for (const relativePath of ['README.md', 'CHANGELOG.md']) {
  const content = readFileSync(path.join(root, relativePath), 'utf8');
  for (const term of blockedTerms) {
    if (content.includes(term)) {
      throw new Error(`${relativePath} contains blocked term: ${term}`);
    }
  }
}

console.log('rnk-reserves validation passed');
