import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createChatGPT, CHATGPT_USAGE_URL } from '@siwc/local';

const execFileAsync = promisify(execFile);
const appData = process.platform === 'win32'
  ? (process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'))
  : process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support')
    : (process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'));
const dataDir = join(appData, 'SoundNote', 'chatgpt');
const storageDir = join(dataDir, 'connections');

let encryption;
if (process.platform === 'win32') {
  const { Dpapi, isPlatformSupported } = await import('@primno/dpapi');
  encryption = {
    id: 'windows-dpapi-current-user-v1',
    isAvailable: () => isPlatformSupported,
    encrypt: (plaintext) => Dpapi.protectData(Buffer.from(plaintext, 'utf8'), null, 'CurrentUser'),
    decrypt: (ciphertext) => Buffer.from(Dpapi.unprotectData(ciphertext, null, 'CurrentUser')).toString('utf8'),
  };
} else if (process.platform === 'darwin') {
  const service = 'com.soundnote.app';
  const account = 'chatgpt-token-encryption-key';
  const getKey = async () => {
    try {
      const { stdout } = await execFileAsync('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w']);
      return Buffer.from(stdout.trim(), 'base64');
    } catch {
      const key = randomBytes(32);
      await execFileAsync('/usr/bin/security', ['add-generic-password', '-U', '-s', service, '-a', account, '-w', key.toString('base64')]);
      return key;
    }
  };
  encryption = {
    id: 'macos-keychain-aes-256-gcm-v1',
    isAvailable: async () => { await execFileAsync('/usr/bin/security', ['list-keychains']); return true; },
    encrypt: async (plaintext) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', await getKey(), iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
    },
    decrypt: async (input) => {
      const value = Buffer.from(input);
      if (value.length < 30 || value[0] !== 1) throw new Error('Unsupported encrypted credential format');
      const decipher = createDecipheriv('aes-256-gcm', await getKey(), value.subarray(1, 13));
      decipher.setAuthTag(value.subarray(13, 29));
      return Buffer.concat([decipher.update(value.subarray(29)), decipher.final()]).toString('utf8');
    },
  };
} else {
  encryption = { id: 'unsupported-os-keychain-v1', isAvailable: () => false, encrypt: () => { throw new Error('Unsupported OS'); }, decrypt: () => { throw new Error('Unsupported OS'); } };
}

const client = createChatGPT({
  appName: 'SoundNote', appId: 'soundnote-local', redirectPort: 0,
  storageDir, sendHostId: true, credentialEncryption: encryption,
  openBrowser: async (url) => {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.hostname !== 'auth.openai.com') throw new Error('Unexpected sign-in destination.');
    if (process.platform === 'win32') await execFileAsync('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true });
    else if (process.platform === 'darwin') await execFileAsync('/usr/bin/open', [url]);
    else await execFileAsync('xdg-open', [url]);
  },
});

let lastAuthError = '';
let inferenceRequests = 0;
let lastModel = '-';
const snapshot = async () => {
  const session = await client.getSession();
  return { ...session, usageUrl: CHATGPT_USAGE_URL, requests: inferenceRequests, lastModel, models: session.sharing ? await client.listModels().then(x => x.map(m => m.slug)).catch(() => []) : [] , error: session.error?.message || lastAuthError || undefined };
};
const send = (res, status, body) => { const data=Buffer.from(JSON.stringify(body)); res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':data.length,'Access-Control-Allow-Origin':'http://127.0.0.1:8765'}); res.end(data); };
const server=createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'http://127.0.0.1:8765','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
  const u=new URL(req.url,'http://127.0.0.1:8766');
  try {
    if(req.method==='GET'&&u.pathname==='/status') return send(res,200,await snapshot());
    if(req.method==='POST'&&u.pathname==='/signin') {
      lastAuthError='';
      client.signIn().then(()=>{lastAuthError='';}).catch(e=>{lastAuthError=e?.message||String(e);});
      return send(res,202,{started:true});
    }
    if(req.method==='POST'&&u.pathname==='/generate') {
      let body=''; for await(const chunk of req) {body+=chunk;if(body.length>80000)throw new Error('입력 텍스트가 너무 깁니다.');}
      const {text,mode}=JSON.parse(body); if(typeof text!=='string'||!text.trim())throw new Error('전사 내용을 먼저 입력해 주세요.');
      const session=await client.getSession(); if(!session.sharing)throw new Error('ChatGPT 로그인과 플랜 사용 권한을 연결해 주세요.');
      const models=await client.listModels(); if(!models.length)throw new Error('사용 가능한 ChatGPT 모델을 찾지 못했습니다.');
      const instructions=mode==='quiz'
        ? '주어진 기록으로 한국어 객관식 퀴즈 5문항을 만드세요. JSON 배열만 반환하세요. 각 문항은 question, options(4개), answer(0부터 시작하는 정답 인덱스), explanation 필드를 갖습니다.'
        : '주어진 기록을 한국어 JSON으로 구조화하세요. 주제, 요점, 용어, 할 일 항목을 포함하세요.';
      const result=await client.streamResponse({model:models[0].slug,instructions,input:text.slice(0,50000)});
      inferenceRequests++; lastModel=models[0].slug;
      return send(res,200,{result:result.text,model:models[0].slug});
    }
    return send(res,404,{error:'Not found'});
  } catch(e){return send(res,400,{error:e?.message||String(e)});}
});
server.listen(8766,'127.0.0.1',()=>process.stdout.write('SoundNote ChatGPT connection service ready\n'));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
