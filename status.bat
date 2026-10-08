@echo off
rem Show what is listening on the Koma ports (6170 app, 6171+ MCP renderer).
setlocal enabledelayedexpansion
set ANY=0
for %%P in (6170 6171 6172 6173 6174 6175) do (
  for /f "tokens=2,5" %%A in ('netstat -ano ^| findstr /r /c:":%%P .*LISTENING"') do (
    set NAME=
    for /f "tokens=1" %%N in ('tasklist /fi "PID eq %%B" /nh') do set NAME=%%N
    if "%%P"=="6170" (echo App          %%A  PID %%B  !NAME!   http://localhost:6170) else (echo MCP renderer %%A  PID %%B  !NAME!)
    set ANY=1
  )
)
if "!ANY!"=="0" echo Koma is not running (ports 6170-6175 are free).
exit /b 0
