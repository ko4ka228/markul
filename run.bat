@echo off
chcp 65001 >nul
title LifeHub - запуск (режим разработки)
where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден. Установите: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Первый запуск: устанавливаю зависимости...
  call npm install
)
call npm start
