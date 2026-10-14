import { app, BrowserWindow, Menu, Tray, dialog, nativeImage, session, shell, utilityProcess } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const productName = 'SoundNote';
app.setName(productName);
const dataBase = process.platform === 'win32'
  ? (process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'))
  : process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support')
    : (process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'));
const dataRoot = join(dataBase, productName);
mkdirSync(dataRoot, { recursive: true });
app.setPath('userData', dataRoot);
const appRoot = app.isPackaged ? app.getAppPath() : resolve(import.meta.dirname, '..');
const backendRoot = app.isPackaged ? join(process.resourcesPath, 'backend') : appRoot;
const appFilesRoot = app.isPackaged ? join(process.resourcesPath, 'backend') : appRoot;
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow;
let tray;
let backend;
let authService;
let quitting = false;
let serverUrl = '';
let bootMessage = '앱을 준비하고 있습니다…';

function setBootMessage(message) {
  bootMessage = message;
  try { appendFileSync(join(dataRoot, 'startup.log'), new Date().toISOString() + ' ' + message + '\n', 'utf8'); } catch {}
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`document.querySelector('#message').textContent = ${JSON.stringify(message)}`).catch(() => {});
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { windowsHide: true, ...options });
    let stderr = '';
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', rejectRun);
    child.once('close', (code) => code === 0 ? resolveRun() : rejectRun(new Error(stderr.trim() || `${command} exited with ${code}`)));
  });
}

function findSystemPython() {
  if (process.platform === 'win32') {
    const listed = spawnSync('py', ['-0p'], { windowsHide: true, encoding: 'utf8' });
    const interpreters = (listed.stdout || '').split(/\r?\n/).flatMap((line) => {
      const version = line.match(/-V:[^\s]*?(3\.\d+)/);
      if (!version) return [];
      const executable = line.slice(version.index + version[0].length).trim().replace(/^\*\s*/, '');
      return existsSync(executable) ? [{ command: executable, prefix: [], version: version[1] }] : [];
    }).filter((item) => Number(item.version.split('.')[1]) <= 13);
    interpreters.sort((a, b) => Number(a.version.split('.')[1]) - Number(b.version.split('.')[1]));
    if (interpreters.length) return interpreters[0];
  }
  const options = process.platform === 'win32'
    ? [['py', ['-3.13']], ['py', ['-3.12']], ['py', ['-3.11']], ['python', []]]
    : [['python3.11', []], ['python3.12', []], ['python3.13', []], ['python3', []], ['python', []]];
  for (const [command, prefix] of options) {
    const result = spawnSync(command, [...prefix, '-c', 'import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 13) else 1)'], { windowsHide: true });
    if (!result.error && result.status === 0) return { command, prefix };
  }
  return null;
}

async function choosePython() {
  const systemPython = findSystemPython();
  if (!systemPython) throw new Error('Python 3.10~3.13이 필요합니다. https://www.python.org/downloads/ 에서 설치한 뒤 SoundNote를 다시 실행해 주세요.');
  const pythonVersion = systemPython.version || (spawnSync(systemPython.command, [...systemPython.prefix, '-c', 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")'], { encoding: 'utf8', windowsHide: true }).stdout || '3.10').trim();
  const runtimeDir = app.isPackaged ? join(dataRoot, `runtime-py${pythonVersion.replace('.', '')}`) : join(appRoot, '.venv');
  const python = process.platform === 'win32' ? join(runtimeDir, 'Scripts', 'python.exe') : join(runtimeDir, 'bin', 'python');
  const requirements = join(appFilesRoot, 'requirements.txt');
  if (!existsSync(python)) {
    setBootMessage('앱 전용 Python 환경을 준비하고 있습니다…');
    await run(systemPython.command, [...systemPython.prefix, '-m', 'venv', runtimeDir], { cwd: dataRoot });
  }
  const check = spawnSync(python, ['-c', 'import faster_whisper, av; assert int(av.__version__.split(".")[0]) < 19'], { windowsHide: true });
  if (check.error || check.status !== 0) {
    setBootMessage('로컬 음성 인식 구성 요소를 설치하고 있습니다. 첫 실행에는 시간이 걸릴 수 있습니다…');
    await run(python, ['-m', 'pip', 'install', '-r', requirements], { cwd: backendRoot });
  }
  return python;
}
async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`${serverUrl}/api/status`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error('SoundNote 로컬 서버가 시작되지 않았습니다.');
}

async function waitForAuthServer(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error('ChatGPT 연결 서비스를 시작하지 못했습니다.');
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#1b7b56"/><path d="M9 18V12m5 10V8m5 14V11m5 7v-5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>';
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`));
  tray.setToolTip('소리노트 · 녹음은 자동 저장 중');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '소리노트 열기', click: showMainWindow },
    { type: 'separator' },
    { label: '소리노트 종료', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showMainWindow);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 940,
    minWidth: 760,
    minHeight: 620,
    show: false,
    backgroundColor: '#f8f9f5',
    title: productName,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.loadFile(join(appRoot, 'desktop', 'loading.html'));
  mainWindow.webContents.once('did-finish-load', () => setBootMessage(bootMessage));
  mainWindow.once('ready-to-show', showMainWindow);
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== serverUrl && !url.startsWith(`${serverUrl}/`)) {
      event.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url);
    }
  });
}

async function startDesktopApp() {
  createTray();
  createWindow();
  try {
    const python = await choosePython();
    const port = await unusedPort();
    const authPort = await unusedPort();
    serverUrl = `http://127.0.0.1:${port}`;
    const authEnv = { ...process.env, SOUNDNOTE_DATA_ROOT: dataRoot, SOUNDNOTE_AUTH_PORT: String(authPort), SOUNDNOTE_DPAPI: '1' };
    authService = utilityProcess.fork(join(appFilesRoot, 'auth-server.mjs'), [], { serviceName: 'SoundNote ChatGPT connection', env: authEnv, stdio: 'ignore' });
    authService.once('exit', (code) => { if (!quitting && code !== 0) console.error(`ChatGPT connection service exited with ${code}`); });
    await waitForAuthServer(authPort);
    const env = {
      ...process.env,
      SOUNDNOTE_ROOT: appFilesRoot,
      SOUNDNOTE_DATA_ROOT: dataRoot,
      SOUNDNOTE_PORT: String(port),
      SOUNDNOTE_AUTH_PORT: String(authPort),
      SOUNDNOTE_AUTH_EXTERNAL: '1',
    };
    backend = spawn(python, [join(appFilesRoot, 'app.py')], { cwd: backendRoot, env, windowsHide: true, stdio: 'ignore' });
    backend.once('error', (error) => { if (!quitting) dialog.showErrorBox(productName, `로컬 서비스 실행 실패: ${error.message}`); });
    await waitForServer();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    await mainWindow.loadURL(serverUrl);
    mainWindow.setTitle('소리노트 — 녹음에서 지식으로');
  } catch (error) {
    try { appendFileSync(join(dataRoot, 'startup-error.log'), new Date().toISOString() + ' ' + (error?.stack || error?.message || String(error)) + '\n', 'utf8'); } catch {}
    setBootMessage(error.message);
    dialog.showErrorBox(productName, error.message);
  }
}

app.on('second-instance', showMainWindow);
app.on('before-quit', () => {
  quitting = true;
  if (backend && !backend.killed) backend.kill();
  if (authService) authService.kill();
});
app.on('window-all-closed', () => {});
app.whenReady().then(() => {
  const isSoundNoteOrigin = (webContents) => {
    try { return new URL(webContents?.getURL() || '').hostname === '127.0.0.1'; } catch { return false; }
  };
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowed = isSoundNoteOrigin(webContents) && (
      (permission === 'media' && (!details.mediaTypes || details.mediaTypes.includes('audio')))
      || permission === 'display-capture'
    );
    callback(allowed);
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => (
    isSoundNoteOrigin(webContents) && (
      (permission === 'media' && (!details.mediaTypes || details.mediaTypes.includes('audio')))
      || permission === 'display-capture'
    )
  ));
  startDesktopApp();
});
