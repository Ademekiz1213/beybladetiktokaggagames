@echo off
chcp 65001 >nul
title Beyblade Arena - Server

echo ==============================
echo   Beyblade Arena Sunucusu
echo ==============================
echo.

:: Açık node server varsa kapat
echo [*] Açık sunucu kontrol ediliyor...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
    echo [!] Eski sunucu kapatıldı.
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] Açık sunucu yok.
)

:: Server klasörüne git
cd /d "%~dp0server"

:: node_modules kontrolü
if not exist "node_modules" (
    echo [*] Bağımlılıklar yükleniyor...
    npm install
    echo.
)

:: Sunucuyu başlat
echo [*] Sunucu başlatılıyor...
echo [*] http://localhost:3000
echo.
echo Kapatmak için bu pencereyi kapatın veya Ctrl+C basın.
echo ==============================
echo.

node server.js

pause
