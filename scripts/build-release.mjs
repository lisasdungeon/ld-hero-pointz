import { rmSync, mkdirSync, cpSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tempDir = path.join(root, '.release-temp');
const moduleZip = path.join(root, 'module.zip');
const zipsDir = path.join(root, 'zips');

const moduleJson = JSON.parse(readFileSync(path.join(root, 'module.json'), 'utf8'));
const versionedZip = path.join(zipsDir, `rnk-reserves-v${moduleJson.version}.zip`);

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });
mkdirSync(zipsDir, { recursive: true });

for (const entry of ['module.json', 'README.md', 'CHANGELOG.md', 'src', 'styles', 'templates', 'languages']) {
  const from = path.join(root, entry);
  if (existsSync(from)) {
    cpSync(from, path.join(tempDir, entry), { recursive: true });
  }
}

rmSync(moduleZip, { force: true });
rmSync(versionedZip, { force: true });

const archiveArgs = ['-NoProfile', '-Command', `Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${moduleZip}' -Force`];
const archiveResult = spawnSync('powershell.exe', archiveArgs, { cwd: root, stdio: 'inherit' });
if (archiveResult.status !== 0) {
  throw new Error('Failed to create module.zip');
}

cpSync(moduleZip, versionedZip);
rmSync(tempDir, { recursive: true, force: true });

console.log(`Built ${path.basename(moduleZip)} and ${path.relative(root, versionedZip)}`);
