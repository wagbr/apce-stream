@echo off
chcp 65001 >nul
title Painel APCE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar estudio.ps1"
if errorlevel 1 pause
