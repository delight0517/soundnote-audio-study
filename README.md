# 소리노트 (SoundNote)

Windows용 로컬 오디오 기록 및 학습 도구입니다. 시스템 오디오를 녹음하고, 전사 텍스트를 퀴즈나 요점 정리로 바꿉니다.

## 시작

1. Windows 10/11, Python 3.10 이상, Node.js 22 이상, Chrome 또는 Edge가 필요합니다.
2. `시작하기.bat`을 실행합니다. 처음 실행할 때 전용 Python 환경과 Node 패키지를 설치합니다.
3. 브라우저에서 `http://127.0.0.1:8765`를 엽니다.
4. 녹음할 탭이나 화면을 선택하고 공유 창에서 시스템 오디오를 켭니다. 영상 트랙은 저장하지 않습니다.
5. 녹음을 끝내고 파일을 저장하거나 전사합니다. 첫 전사 때 로컬 Whisper 다국어 small 모델(약 500MB)을 내려받습니다. 녹음 오디오는 전사 과정에서 PC 밖으로 나가지 않습니다.
6. ChatGPT 플랜, OpenAI API, Claude Code, Antigravity 중 생성할 서비스를 선택하고 퀴즈/요약을 만듭니다. CLI 제공자를 선택하면 입력한 전사 텍스트가 해당 업체로 전송됩니다.

## AI 연결

- **ChatGPT 플랜:** OpenAI의 로컬 앱용 Sign in with ChatGPT 흐름을 사용합니다. 플랜 사용은 OpenAI 승인 화면에서 별도로 허용해야 합니다. 토큰은 Windows DPAPI로 현재 Windows 사용자 계정에 묶어 저장합니다.
- **OpenAI API:** API 키를 직접 연결합니다. 키는 메모리에만 저장됩니다. 생성에 사용할 수 있습니다. ChatGPT 플랜 요금과 API 요금은 별도입니다.
- **Claude Code:** 공식 Claude Code Windows 실행 파일을 찾아 `claude auth login`으로 로그인합니다. 이 앱은 PATH에 등록된 `.cmd`/`.bat` 래퍼를 실행하지 않습니다. 공식 실행 파일이 표준 설치 경로에 있을 때 연결됩니다. 텍스트 생성은 공식 `claude -p` 명령을 호출합니다.
- **Google Antigravity:** 공식 `agy.exe`를 사용합니다. 로그인을 위해 CLI를 열고 Google 계정 승인을 완료하세요. 텍스트 생성은 공식 `agy -p` 명령을 호출합니다.

Claude Code와 Antigravity 사용량은 각 공식 CLI가 관리합니다. 이 앱은 세션 요청 수만 표시하며 해당 플랜의 잔여 사용량을 읽지 않습니다. 플랜 제공자 선택은 사용자의 행동이며, 각 업체로 보낼 텍스트의 목적지를 확인한 뒤 선택하세요.

## 데이터와 보안

- 서버는 `127.0.0.1`에만 바인딩됩니다.
- 녹음은 브라우저 메모리에 유지되며 사용자가 저장할 수 있습니다. 앱은 녹음 파일을 자동 업로드하거나 디스크에 자동 저장하지 않습니다.
- 전사는 faster-whisper의 다국어 small 모델을 CPU int8로 로컬 실행합니다. 모델 가중치는 최초 1회 Hugging Face에서 내려받으며, 전사 오디오는 외부로 보내지 않습니다. 모델은 `%LOCALAPPDATA%\SoundNote\models`에 저장됩니다.
- 퀴즈/요약은 선택한 공급자의 API 또는 공식 CLI로 전사 내용을 보냅니다.
- ChatGPT 자격 증명은 DPAPI, Claude/Google 자격 증명은 각 공식 CLI가 관리합니다. 이 앱은 Claude/Google 토큰을 읽거나 복사하지 않습니다.
- 이 프로젝트는 단일 사용자 로컬 MVP입니다. 공용 네트워크나 다중 사용자 서버에 노출하지 마세요.

## 라이선스 범위

앱에서 직접 작성한 코드는 MIT License로 배포합니다. `vendor/siwc-local`은 OpenAI의 Sign in with ChatGPT Devkit이며 별도의 **비상업 라이선스**와 고지 사항이 적용됩니다. 따라서 이 저장소 전체를 상업적 사용을 허용하는 단일 MIT 오픈소스 패키지로 간주할 수 없습니다. 해당 SDK의 파일과 고지를 수정·삭제하지 마세요. 다른 상업적 용도에는 OpenAI의 별도 허가가 필요할 수 있습니다.

제3자 패키지는 각 패키지 라이선스가 적용됩니다. OpenAI, Anthropic, Google 제품의 이름은 연결되는 서비스를 식별하기 위한 용도입니다.

## 개발 및 확인

```powershell
npm install
npm run build:siwc
python app.py
```

### 현재 확인한 범위

- Python/JavaScript 구문 검사, Sign in with ChatGPT SDK 빌드, 앱 HTTP 응답 및 로그인 상태 확인.
- ChatGPT 플랜으로 합성 텍스트 요약 요청 1회 성공.
- 별도 Windows WASAPI loopback 점검에서 시스템 오디오 WAV 파일 생성과 비영(非零) 샘플을 확인.
- 브라우저 화면 공유 선택창의 Windows 권한 단계는 자동화 환경에서 완료하지 못해, 이 앱 UI에서 녹음 파일이 끝까지 만들어지는 흐름은 아직 직접 확인하지 못했습니다.
- 실제 Claude 및 Antigravity 생성 요청은 계정 사용량이 발생할 수 있어 이 작업에서는 전송하지 않았습니다.
- faster-whisper small CPU int8 모델로 합성 한국어/영어 음성을 전사했고, 언어 자동 감지와 앱의 `/api/transcribe` 경로까지 확인했습니다.
