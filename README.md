# 소리노트 (SoundNote)

Windows와 macOS용 로컬 오디오 기록 및 학습 도구입니다. 시스템 오디오를 녹음하고, 전사 텍스트를 퀴즈나 요점 정리로 바꿉니다.

## 언어

화면 오른쪽 위 언어 메뉴에서 한국어, 영어, 일본어, 중국어(간체), 스페인어, 프랑스어, 독일어, 포르투갈어(브라질), 힌디어, 아랍어, 이탈리아어를 선택할 수 있습니다. 언어 선택은 기기에 저장되며, 지원하지 않는 브라우저 언어에서는 영어를 기본으로 표시합니다. 번역은 앱 안의 로컬 카탈로그에서 제공됩니다.

## 공개 다운로드 사이트와 로그인

GitHub Pages에서 무료 다운로드 사이트를 운영합니다: `https://delight0517.github.io/soundnote-audio-study/`. 공개 사이트는 GitHub Releases에서 Windows 설치 파일과 Apple Silicon/Intel Mac용 DMG를 찾아 다운로드 링크를 표시합니다. `Publish SoundNote site and desktop downloads` 워크플로를 수동 실행하면 Windows 및 두 Mac 아키텍처를 빌드해 Release에 올립니다. GitHub-hosted macOS 빌드는 서명하지 않으므로 첫 실행 때 Gatekeeper 안내가 표시될 수 있습니다.

사이트의 Google 로그인은 다운로드 사이트에서 Google 계정을 표시하는 용도입니다. Google Identity Services의 웹 OAuth Client ID를 GitHub 저장소의 `GOOGLE_CLIENT_ID` Actions variable로 설정하면 버튼이 활성화됩니다. GitHub Pages에는 서버가 없으므로 이 로그인은 사용자별 서버 데이터 접근을 인증하지 않습니다. 녹음과 텍스트는 계속 각 기기에 저장되며 기기 간 동기화는 제공하지 않습니다. 클라우드 계정과 사용자별 저장소를 제공하려면 별도 API/DB 백엔드와 Google ID 토큰의 서버 검증을 배포해야 합니다.

Google Cloud OAuth 웹 클라이언트의 승인된 JavaScript 출처에 `https://delight0517.github.io`를 추가합니다. Client ID는 공개 식별자이므로 저장소 variable로 둘 수 있습니다. 클라이언트 비밀값은 정적 사이트에 넣지 마세요.

## 시작

### 데스크톱 앱 (권장)

녹음 중 브라우저 탭이 닫혀도 파일이 남도록 Windows/macOS용 Electron 데스크톱 앱을 제공합니다. 창의 닫기 버튼은 앱을 종료하지 않고 시스템 트레이로 보냅니다. 트레이 메뉴에서 앱을 다시 열거나 완전히 종료할 수 있습니다.

- Windows 설치 프로그램: 저장소의 Releases에서 `SoundNote-Setup-*.exe`를 내려받아 설치합니다.
- macOS 앱: Releases의 `SoundNote-*-arm64.dmg` 또는 `SoundNote-*-x64.dmg`를 사용합니다. 최초 실행 전에 macOS 화면 기록 권한을 허용해야 합니다.
- 개발 환경에서 실행: Node.js 22 이상과 Python 3.10 이상을 설치하고 `npm install`, `npm run desktop`을 실행합니다. 첫 실행은 로컬 음성 인식 환경을 준비하느라 시간이 걸릴 수 있습니다.
- 설치 패키지 빌드: Windows에서 `npm run desktop:dist:win`, Mac에서 `npm run desktop:dist:mac`을 실행합니다. Mac 패키지는 실제 Mac에서 빌드하고 오디오 권한까지 확인해야 합니다. 배포용 서명/공증 인증서가 없으면 macOS에서 개발자 확인 경고가 표시될 수 있습니다.

데스크톱 앱은 녹음 조각을 1초마다 사용자 데이터 폴더에 저장합니다. 앱이 갑자기 종료되면 다음 실행 후 `자동 저장된 녹음`에서 임시 파일을 복구해 전사할 수 있습니다. 녹음 파일은 기기 안에 보관되며 사용자가 삭제할 때까지 유지됩니다. 설치본은 앱 전용 Python 환경을 만들고, 로컬 Whisper 모델은 최초 전사 때 다운로드합니다.

### Windows

1. Windows 10/11, Python 3.10 이상, Node.js 22 이상, Chrome 또는 Edge를 설치합니다.
2. `시작하기.bat`을 실행합니다. 처음 실행할 때 전용 Python 환경과 Node 패키지를 설치합니다.
3. 브라우저에서 `http://127.0.0.1:8765`를 엽니다.
4. 녹음할 탭이나 화면을 선택하고 공유 창에서 오디오를 켭니다. 영상 트랙은 저장하지 않습니다.
5. 녹음을 끝내고 파일을 저장하거나 전사합니다. 첫 전사 때 로컬 Whisper 다국어 small 모델(약 500MB)을 내려받습니다. 녹음 오디오는 전사 과정에서 PC 밖으로 나가지 않습니다.
6. ChatGPT 플랜, OpenAI API, Claude Code, Antigravity 중 생성할 서비스를 선택하고 퀴즈/요약을 만듭니다. CLI 제공자를 선택하면 입력한 전사 텍스트가 해당 업체로 전송됩니다.

### macOS

1. macOS 13 이상, Python 3.10 이상, Node.js 22 이상, 최신 Chrome 또는 Edge가 필요합니다.
2. 저장소 폴더에서 `./start-macos.command`를 실행합니다. macOS가 실행을 차단하면 Terminal에서 `chmod +x start-macos.command`를 한 번 실행한 뒤 다시 엽니다.
3. 처음 실행할 때 Python/Node 의존성을 설치합니다. 브라우저 화면 기록 권한을 허용하고, 공유 선택창에서 오디오가 포함된 화면이나 탭을 선택합니다. macOS와 브라우저에 따라 시스템 오디오가 공유 선택창에 제공되지 않을 수 있습니다.
4. 기본 브라우저에서 `http://127.0.0.1:8765`가 열립니다. Python 및 모델 캐시는 `~/Library/Application Support/SoundNote`에 둡니다.

전사 파일은 로컬 처리이므로 별도 API 전사 비용이 없습니다. 다만 실제 오디오 캡처는 Mac 모델, macOS 권한, 선택한 공유 소스 및 브라우저 지원에 따라 확인이 필요합니다.

## AI 연결

- **ChatGPT 모델:** 로그인 후 해당 계정에서 실제로 사용 가능한 모델 목록을 불러와 선택합니다. 기본값은 목록의 `mini`/`nano` 계열 중 첫 번째 저비용 모델이며, 추론 강도는 `low`로 요청합니다(지원하지 않는 모델에는 `none`을 전달). 선택은 이 브라우저/앱에 저장됩니다.

- **ChatGPT 플랜:** OpenAI의 로컬 앱용 Sign in with ChatGPT 흐름을 사용합니다. 플랜 사용은 OpenAI 승인 화면에서 별도로 허용해야 합니다. 토큰 암호화 키는 Windows에서 DPAPI, macOS에서 Keychain으로 보호합니다.
- **OpenAI API:** API 키를 직접 연결합니다. 키는 메모리에만 저장됩니다. 생성에 사용할 수 있습니다. ChatGPT 플랜 요금과 API 요금은 별도입니다.
- **Claude Code:** 운영체제에 설치된 공식 CLI로 로그인합니다. Windows에서는 PATH의 `.cmd`/`.bat` 래퍼를 실행하지 않습니다. 텍스트 생성은 공식 `claude -p` 명령을 호출합니다.
- **Google Antigravity:** 공식 `agy` CLI(Windows에서는 `agy.exe`)를 사용합니다. 로그인을 위해 CLI를 열고 Google 계정 승인을 완료하세요. 텍스트 생성은 공식 `agy -p` 명령을 호출합니다.

Claude Code와 Antigravity 사용량은 각 공식 CLI가 관리합니다. 이 앱은 세션 요청 수만 표시하며 해당 플랜의 잔여 사용량을 읽지 않습니다. 플랜 제공자 선택은 사용자의 행동이며, 각 업체로 보낼 텍스트의 목적지를 확인한 뒤 선택하세요.

## 데이터와 보안

- 로컬 모드는 `127.0.0.1`에 바인딩됩니다. 공개 모드는 로그인된 Google 사용자만 `/api/*` 개인 데이터 API에 접근할 수 있습니다.
- 데스크톱 앱은 녹음 오디오를 1초마다 로컬 사용자 데이터 폴더의 `recordings`에 자동 저장합니다. 녹음 조각을 앱 제공자에게 업로드하지 않습니다. 브라우저 실행본은 자동 저장을 제공하지 않습니다.
- 라이브러리는 전사/입력 텍스트만 OS별 사용자 데이터 폴더의 `library.json`에 저장합니다. 기록별 열기, 삭제, 운영체제 공유(텍스트)를 지원하며 오디오는 포함하지 않습니다. 라이브러리는 기기 간 자동 동기화되지 않습니다.
- 전사는 faster-whisper의 다국어 small 모델을 CPU int8로 로컬 실행합니다. 모델 가중치는 최초 1회 Hugging Face에서 내려받으며, 전사 오디오는 외부로 보내지 않습니다. 모델은 OS별 사용자 데이터 폴더의 `models`에 저장됩니다.
- 퀴즈/요약은 선택한 공급자의 API 또는 공식 CLI로 전사 내용을 보냅니다.
- ChatGPT 자격 증명은 Windows DPAPI/macOS Keychain, Claude/Google 자격 증명은 각 공식 CLI가 관리합니다. 이 앱은 Claude/Google 토큰을 읽거나 복사하지 않습니다.
- 공개 서비스의 Google 계정은 데이터를 격리하지만 사용자별 OpenAI 사용량/청구는 각자의 API 계정이 관리합니다. 공개 서비스 관리자는 서버에 저장된 녹음과 텍스트를 운영상 접근할 수 있으므로 사용자는 민감한 오디오를 업로드하지 않도록 안내해야 합니다.

## 라이선스 범위

앱에서 직접 작성한 코드는 MIT License로 배포합니다. `vendor/siwc-local`은 OpenAI의 Sign in with ChatGPT Devkit이며 별도의 **비상업 라이선스**와 고지 사항이 적용됩니다. 따라서 이 저장소 전체를 상업적 사용을 허용하는 단일 MIT 오픈소스 패키지로 간주할 수 없습니다. 해당 SDK의 파일과 고지를 수정·삭제하지 마세요. 다른 상업적 용도에는 OpenAI의 별도 허가가 필요할 수 있습니다.

제3자 패키지는 각 패키지 라이선스가 적용됩니다. OpenAI, Anthropic, Google 제품의 이름은 연결되는 서비스를 식별하기 위한 용도입니다.

## 개발 및 확인

```powershell
npm install
npm run build:siwc
python app.py
```

macOS에서는 `./start-macos.command`로 실행합니다.

### 현재 확인한 범위

- Python/JavaScript 구문 검사, Sign in with ChatGPT SDK 빌드, 앱 HTTP 응답 및 로그인 상태 확인.
- ChatGPT 플랜으로 합성 텍스트 요약 요청 1회 성공.
- 별도 Windows WASAPI loopback 점검에서 시스템 오디오 WAV 파일 생성과 비영(非零) 샘플을 확인.
- 브라우저 화면 공유 선택창의 Windows 권한 단계는 자동화 환경에서 완료하지 못해, 이 앱 UI에서 녹음 파일이 끝까지 만들어지는 흐름은 아직 직접 확인하지 못했습니다.
- 실제 Claude 및 Antigravity 생성 요청은 계정 사용량이 발생할 수 있어 이 작업에서는 전송하지 않았습니다.
- faster-whisper small CPU int8 모델로 합성 한국어/영어 음성을 전사했고, 언어 자동 감지와 앱의 `/api/transcribe` 경로까지 확인했습니다.
- 라이브러리 저장/열기/공유 화면과 macOS 시작 스크립트, Keychain 암호화 코드를 구현했습니다. macOS 실기기에서는 아직 실행 및 오디오 권한 흐름을 검증하지 못했습니다.
