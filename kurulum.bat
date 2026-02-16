@echo off
chcp 65001 >nul
title Beyblade Arena - Kurulum
color 0B

echo.
echo ╔══════════════════════════════════════╗
echo ║   🎮 Beyblade Arena - Otomatik Kurulum   ║
echo ╚══════════════════════════════════════╝
echo.

:: ==========================================
:: 1. Node.js kontrolü
:: ==========================================
echo [1/3] Node.js kontrol ediliyor...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [HATA] Node.js bulunamadi!
    echo.
    echo Node.js'i indirip kurun: https://nodejs.org
    echo Onerilir: LTS surumu indirin.
    echo.
    echo Kurulumdan sonra bu dosyayi tekrar calistirin.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js bulundu: %NODE_VER%

:: npm kontrolü
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] npm bulunamadi! Node.js kurulumunu kontrol edin.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [OK] npm bulundu: v%NPM_VER%
echo.

:: ==========================================
:: 2. Server bağımlılıkları
:: ==========================================
echo [2/3] Server bagimliliklari yukleniyor...
cd /d "%~dp0server"

if exist "node_modules" (
    echo [OK] node_modules zaten mevcut. Guncelleniyor...
)

call npm install
if %errorlevel% neq 0 (
    echo.
    echo [HATA] Bagimliliklari yuklerken hata olustu!
    echo Lütfen internet baglantinizi kontrol edin.
    pause
    exit /b 1
)
echo [OK] Bagimliliklar basariyla yuklendi!
echo.

:: ==========================================
:: 3. Doğrulama
:: ==========================================
echo [3/3] Kurulum dogrulanıyor...

cd /d "%~dp0"

:: server.js kontrolü
if not exist "server\server.js" (
    echo [HATA] server\server.js bulunamadi!
    pause
    exit /b 1
)
echo   - server.js ............. OK

:: client kontrolü
if not exist "client\index.html" (
    echo [HATA] client\index.html bulunamadi!
    pause
    exit /b 1
)
echo   - index.html ............ OK

:: node_modules kontrolü
if not exist "server\node_modules" (
    echo [HATA] node_modules yuklenmedi!
    pause
    exit /b 1
)
echo   - node_modules .......... OK

:: express kontrolü
if not exist "server\node_modules\express" (
    echo [UYARI] express paketi eksik!
) else (
    echo   - express ............... OK
)

:: socket.io kontrolü
if not exist "server\node_modules\socket.io" (
    echo [UYARI] socket.io paketi eksik!
) else (
    echo   - socket.io ............. OK
)

:: tiktok-live-connector kontrolü
if not exist "server\node_modules\tiktok-live-connector" (
    echo [UYARI] tiktok-live-connector paketi eksik!
) else (
    echo   - tiktok-live-connector .. OK
)

echo.
echo ╔══════════════════════════════════════╗
echo ║   ✅ Kurulum Basariyla Tamamlandi!       ║
echo ╠══════════════════════════════════════╣
echo ║                                          ║
echo ║   Sunucuyu baslatmak icin:               ║
echo ║   → baslat.bat dosyasini calistirin      ║
echo ║                                          ║
echo ║   Tarayicida acin:                       ║
echo ║   → http://localhost:3000                ║
echo ║                                          ║
echo ╚══════════════════════════════════════╝
echo.
pause
