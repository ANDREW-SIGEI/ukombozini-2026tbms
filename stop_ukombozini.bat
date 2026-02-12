@echo off
echo ==============================================
echo       UKOMBOZINI TBMS - SYSTEM SHUTDOWN
echo ==============================================
echo.

echo Stopping UKOMBOZINI services...
docker-compose down

echo.
echo [DONE] System has been shut down safely.
pause
