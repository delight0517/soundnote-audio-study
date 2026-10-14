@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
  echo Node.js 22 or later is required for ChatGPT sign-in.
  pause
  exit /b 1
)
if not exist "node_modules\@siwc\local" (
  echo Installing the local ChatGPT connection service...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo Creating a private Python environment for local transcription...
  python -m venv .venv
  if errorlevel 1 pause & exit /b 1
)
call .venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 pause & exit /b 1
call npm run build:siwc
if errorlevel 1 pause & exit /b 1
.venv\Scripts\python.exe app.py
if errorlevel 1 pause
