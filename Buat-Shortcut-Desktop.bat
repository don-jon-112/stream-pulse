@echo off
title Buat Shortcut StreamPulse Desktop
powershell -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"
echo.
pause
