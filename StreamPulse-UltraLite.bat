@echo off
title StreamPulse MultiChat - Ultra Lite
echo ========================================================
echo   StreamPulse MultiChat - Mode Ultra-Lite (RAM Rendah)
echo ========================================================

:: Cek lokasi msedge
set EDGE_PATH=""
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set EDGE_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set EDGE_PATH="C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

:: Cek apakah server port 3000 sudah jalan (cepat tanpa lag)
powershell -NoProfile -Command "$c = New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 3000); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
    start "" /b node --max-old-space-size=48 "%~dp0server.js"
    timeout /t 2 /nobreak >nul
)

:: Jalankan jendela aplikasi desktop via Windows Edge Native App (RAM ~40MB)
if not %EDGE_PATH%=="" (
    start "" %EDGE_PATH% --app=http://localhost:3000/?lite=1 --window-size=1360,840 --mute-audio
) else (
    start http://localhost:3000/?lite=1
)

exit
