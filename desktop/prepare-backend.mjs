import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const runtime = join(root, 'desktop-runtime', 'backend');
await mkdir(runtime, { recursive: true });
for (const file of ['app.py', 'auth-server.mjs', 'app.js', 'i18n.js', 'index.html', 'style.css', 'requirements.txt']) {
  await cp(join(root, file), join(runtime, file));
}
await cp(join(root, 'vendor', 'siwc-local'), join(runtime, 'vendor', 'siwc-local'), { recursive: true });
const runtimePackage = {
  name: 'soundnote-backend-runtime',
  private: true,
  type: 'module',
  dependencies: {
    '@siwc/local': 'file:vendor/siwc-local',
    jose: '^6.1.0',
    openai: '^7.21.0',
    'proper-lockfile': '^4.1.2',
  },
};
await writeFile(join(runtime, 'package.json'), JSON.stringify(runtimePackage, null, 2));

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
await new Promise((resolveRun, rejectRun) => {
  const child = spawn(npm, ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: runtime, stdio: 'inherit', shell: process.platform === 'win32' });
  child.once('error', rejectRun);
  child.once('close', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`npm install exited with ${code}`)));
});

const dpapiPackage = join(runtime, 'node_modules', '@primno', 'dpapi');
await rm(dpapiPackage, { recursive: true, force: true });
const localPackage = join(runtime, 'node_modules', '@siwc', 'local');
await rm(localPackage, { recursive: true, force: true });
await cp(join(runtime, 'vendor', 'siwc-local'), localPackage, { recursive: true });
const packagedModules = join(root, 'desktop-runtime', 'backend-modules');
await rm(packagedModules, { recursive: true, force: true });
await cp(join(runtime, 'node_modules'), packagedModules, { recursive: true });
console.log(`Prepared desktop backend at ${runtime}`);
