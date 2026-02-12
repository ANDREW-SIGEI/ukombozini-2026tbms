@echo off
echo ==============================================
echo       UKOMBOZINI TBMS - SYSTEM LAUNCHER
echo ==============================================
echo.

echo [CHECK] Verifying Docker installation...
docker --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is NOT found! 
    echo Please install Docker Desktop for Windows and ensure it is running.
    echo Download: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b
)

echo [OK] Docker is present.
echo.

echo [STEP 1] Stopping any existing instances...
docker-compose down

echo.
echo [STEP 2] Building and Starting UKOMBOZINI Stack...
echo (This may take a few minutes for the first run)...
docker-compose up --build -d

IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start Docker containers.
    pause
    exit /b
)

echo.
echo [STEP 3] Waiting for Database/API initialization...
timeout /t 15

echo.
echo [SUCCESS] System is ONLINE! 🚀
echo.
echo - Frontend: http://localhost
echo - Database: Port 5432
echo - Redis:    Port 6379
echo.
echo Opening Dashboard...
start http://localhost

pause
