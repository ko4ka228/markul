@echo off
chcp 65001 >nul
title LifeHub - сборка .exe
echo.
echo ============================================
echo        LifeHub — сборка приложения .exe
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден.
  echo Скачайте и установите Node.js LTS: https://nodejs.org
  echo После установки запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

echo [1/2] Устанавливаю зависимости (это может занять пару минут)...
call npm install
if errorlevel 1 (
  echo.
  echo [ОШИБКА] Не удалось установить зависимости.
  pause
  exit /b 1
)

echo.
echo [2/2] Собираю .exe...
call npm run dist
if errorlevel 1 (
  echo.
  echo [ОШИБКА] Сборка не удалась.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   ГОТОВО! Файлы находятся в папке "dist":
echo     - LifeHub Setup 1.0.0.exe   (установщик)
echo     - LifeHub-Portable-1.0.0.exe (без установки)
echo ============================================
echo.
start "" explorer "%~dp0dist"
pause
