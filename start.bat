@echo off
rem Start the Koma app (Vite dev server) on http://localhost:6170 and open it.
rem   start.bat            start (if needed) and open the browser
rem   start.bat nobrowser  start without opening the browser
setlocal
set PORT=6170
cd /d "%~dp0"

call :listening %PORT%
if not errorlevel 1 (
  echo Koma is already running at http://localhost:%PORT%
  goto open
)

if not exist node_modules (
  echo Installing dependencies ^(first run^)...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting Koma on http://localhost:%PORT% ...
start "Koma (port %PORT%)" /min cmd /c "npm run dev"

rem wait up to ~30 s for the server to listen
for /l %%i in (1,1,30) do (
  call :listening %PORT%
  if not errorlevel 1 goto ready
  ping -n 2 127.0.0.1 >nul
)
echo The server did not start within 30 seconds. Check the "Koma" window for errors.
exit /b 1

:ready
echo Running. Use stop.bat to stop it.

:open
if /i "%~1"=="nobrowser" exit /b 0
start "" http://localhost:%PORT%
exit /b 0

:listening
netstat -ano | findstr /r /c:":%1 .*LISTENING" >nul
exit /b %errorlevel%
