import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createChatGPT, CHATGPT_USAGE_URL } from '@siwc/local';
import { Dpapi, isPlatformSupported } from '@primno/dpapi';

const execFileAsync = promisify(execFile);
const dataDir = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'SoundNote', 'chatgpt');
const storageDir = join(dataDir, 'connections');

// Protect OAuth tokens at rest with Windows DPAPI, scoped to the current Windows user.
const encryption = {
  id: 'windows-dpapi-current-user-v1',
  isAvailable: () => process.platform === 'win32' && isPlatformSupported,
  encrypt: (plaintext) => Dpapi.protectData(Buffer.from(plaintext, 'utf8'), null, 'CurrentUser'),
  decrypt: (ciphertext) => Buffer.from(Dpapi.unprotectData(ciphertext, null, 'CurrentUser')).toString('utf8'),
};

const client = createChatGPT({
  appName: 'SoundNote', appId: 'soundnote-local', redirectPort: 0,
  storageDir, sendHostId: true, credentialEncryption: encryption,
  openBrowser: async (url) => {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.hostname !== 'auth.openai.com') throw new Error('Unexpected sign-in destination.');
    await execFileAsync('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true });
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
