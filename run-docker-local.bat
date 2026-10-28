@echo off
setlocal
cd /d "%~dp0"

set FRONTEND_BIND=127.0.0.1
set FRONTEND_PORT=18080

if not exist docker-data mkdir docker-data
if not exist docker-data\uploads mkdir docker-data\uploads

docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.local.yml ps

echo.
echo Open http://127.0.0.1:18080
pause
