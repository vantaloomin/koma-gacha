@echo off
rem Restart the Koma app (stop, then start). Pass "nobrowser" to skip opening the browser.
cd /d "%~dp0"
call "%~dp0stop.bat"
ping -n 2 127.0.0.1 >nul
call "%~dp0start.bat" %1
