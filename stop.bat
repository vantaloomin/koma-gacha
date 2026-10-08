@echo off
rem Stop Koma.
rem   stop.bat       stop the app (port 6170)
rem   stop.bat mcp   also stop a stuck MCP comic server and its headless renderer (ports 6171-6175);
rem                  your MCP client restarts it the next time it is used
rem   stop.bat all   same as mcp
setlocal enabledelayedexpansion
set PORTS=6170
if /i "%~1"=="mcp" set PORTS=6170 6171 6172 6173 6174 6175
if /i "%~1"=="all" set PORTS=6170 6171 6172 6173 6174 6175

set FOUND=0
for %%P in (%PORTS%) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
    if not "!DONE_%%A!"=="1" (
      echo Stopping process %%A on port %%P
      taskkill /PID %%A /T /F >nul 2>&1
      set DONE_%%A=1
      set FOUND=1
    )
  )
)
if "!FOUND!"=="0" echo Nothing was running on: %PORTS%
exit /b 0
