@echo off
echo ==============================================
echo       UKOMBOZI TBMS - SYSTEM SHUTDOWN
echo ==============================================
echo.

echo Stopping UKOMBOZI services...
docker-compose down

echo.
echo [DONE] System has been shut down safely.
pause
