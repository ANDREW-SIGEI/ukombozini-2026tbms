@echo off
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo   UKOMBOZINI TBMS - PRODUCTION DEPLOYMENT SCRIPT
echo ===================================================
echo.

:: 1. DEPLOYMENT CONFIGURATION
set BACKEND_DIR=backend
set FRONTEND_DIR=frontend
set DB_FILE=ukombozini.sqlite
set BACKUP_DIR=backups
set DATE_STAMP=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%
set DATE_STAMP=%DATE_STAMP: =0%

:: 2. CHECK PREREQUISITES
echo [1/6] Checking prerequisites...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js.
    pause
    exit /b 1
)
echo [OK] Node.js found.

:: 3. BACKUP DATABASE
echo.
echo [2/6] Backing up database...
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if exist "%BACKEND_DIR%\%DB_FILE%" (
    copy "%BACKEND_DIR%\%DB_FILE%" "%BACKUP_DIR%\%DB_FILE%_%DATE_STAMP%.bak" >nul
    echo [OK] Database backed up to %BACKUP_DIR%\%DB_FILE%_%DATE_STAMP%.bak
) else (
    echo [WARNING] Database file not found at %BACKEND_DIR%\%DB_FILE%. Skipping backup.
)

:: 4. INSTALL DEPENDENCIES
echo.
echo [3/6] Installing dependencies (this may take a while)...
call npm install --prefix %BACKEND_DIR% --production
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b 1
)
call npm install --prefix %FRONTEND_DIR% --production
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

:: 5. BUILD FRONTEND
echo.
echo [4/6] Building frontend...
cd %FRONTEND_DIR%
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed.
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Frontend built successfully.

:: 6. SETUP PRODUCTION ENV
echo.
echo [5/6] Setting up production environment...
if not exist "%BACKEND_DIR%\.env" (
    echo [WARNING] No .env file found in backend. Creating default...
    echo PORT=5000 > "%BACKEND_DIR%\.env"
    echo NODE_ENV=production >> "%BACKEND_DIR%\.env"
    echo DATABASE_URL=./%DB_FILE% >> "%BACKEND_DIR%\.env"
    echo JWT_SECRET=change_this_secret_in_production >> "%BACKEND_DIR%\.env"
)

:: 7. START SERVERS
echo.
echo [6/6] Starting servers...
echo.
echo ===================================================
echo   DEPLOYMENT SUCCESSFUL!
echo   Starting Backend and Frontend...
echo.
echo   - Backend: http://localhost:5000
echo   - Frontend: Serving static build...
echo ===================================================
echo.

:: Start Backend in background (using start /B)
start "Ukombozi Backend" /D "%BACKEND_DIR%" cmd /c "npm start"

:: Serve Frontend (using serve package or similar, assuming it's installed or use npx)
echo Starting Frontend Server (npx serve)...
npx serve -s %FRONTEND_DIR%\build -l 3000

pause
