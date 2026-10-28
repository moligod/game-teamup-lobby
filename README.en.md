# TroveBBS website

[中文](README.md) | [中文](README.md)

Game TeamUp Lobby (formerly TroveBBS) is a game team-finding lobby currently tailored to Trove. React, TypeScript and Vite frontend; Node.js, Express and PostgreSQL backend. Features include a team lobby, leaderboard, marketplace, profiles, social features and administration. Leaderboard collection is supplied by the separately distributed Trove leaderboard collector.

## Run with Docker

Install Docker and Docker Compose, then from this directory in PowerShell:

```powershell
Copy-Item .env.example .env
# Edit .env: replace POSTGRES_PASSWORD and USER_SESSION_SECRET.
# Set ADMIN_PASSWORD if an initial administrator is needed.
docker compose up -d --build
docker compose ps
Invoke-WebRequest http://127.0.0.1:8080/health -UseBasicParsing
```

The example configuration binds the frontend to `127.0.0.1:8080`; change `FRONTEND_BIND` and `FRONTEND_PORT` in `.env` as needed. First startup creates a PostgreSQL volume and applies ordered migrations. An empty `ADMIN_PASSWORD` does not create or update the initial administrator. Back up the database and uploads before upgrading an existing instance; do not run `docker compose down -v` to clean an existing deployment.

## Configuration and secrets

Copy `.env.example` to `.env` and edit the latter. The file is Git-ignored. Replace all placeholder credentials with independently generated long random values. Never put secrets into frontend `VITE_` variables: these are built into browser code.

| Variables | Purpose |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database name and credentials. Changing the password in `.env` on an existing volume also requires updating the database user. |
| `USER_SESSION_SECRET` | Independent long random secret for signing user sessions. Changing it may invalidate sessions. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` | Initial admin; a password is required to create or update it. |
| `LEADERBOARD_COLLECTOR_TOKEN` | At least 32 random characters; enter the same value in the collector upload window. Empty disables collector endpoints. |
| `PUBLIC_BASE_URL`, `FRONTEND_BASE_URL` | Your public deployment URLs; replace examples. |
| `QQ_OAUTH_API_URL`, `QQ_OAUTH_APPID`, `QQ_OAUTH_APPKEY`, `QQ_OAUTH_CALLBACK_URL` | Your compatible QQ OAuth service URL, credentials and registered callback, e.g. `https://your-domain.example/api/auth/qq/callback`. The sample provider address is a placeholder. |
| `TROVEPAL_API_KEY`, `TROVEPAL_APP_NAME` | Optional TrovePal announcements key and bound application name. |
| `IMAGE_HOST_BASE_URL`, `IMAGE_HOST_API_KEY`, `IMAGE_HOST_REVIEW_FOLDER_ID` | Optional image host settings; the administration UI can also set these. The production Compose file currently requires configuration through the admin UI. |
| `QQ_BOT_APP_ID`, `QQ_BOT_APP_SECRET`, `QQ_BOT_TEAM_URL` | Optional QQ bot credentials and lobby URL. Subsequent admin UI settings take precedence. |
| `VITE_API_BASE_URL`, `VITE_WS_BASE_URL` | Optional build-time API/WebSocket origins. Same-origin proxy deployments normally leave these empty. Do not put secrets here. |

If your QQ bot platform requires an ownership-verification file, place your own `<application-id>.json` in `public/` according to the platform instructions. Do not reuse another site's application ID.

Admin integration settings can also be stored in PostgreSQL; the collector stores its token in SQLite. Do not publish databases, backups, `docker-data/`, uploaded files, logs or old Git history. If a credential was committed before, rotate it; deleting the current file does not remove it from history.

## Development and deployment

Use Node.js `^20.19.0` or `>=22.12.0` (Node 22 recommended):

```powershell
npm ci
npm ci --prefix server
npm run build
npm --prefix server test
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
```

`npm run dev` starts Vite on port 5173 and the backend on port 3000. The backend requires PostgreSQL and environment variables; direct execution does not automatically load `.env`. Use Docker above or supply environment variables to the process.

Public endpoints are `/api`, `/health`, `/uploads` and WebSocket `/ws`. For a public deployment, configure HTTPS and a reverse proxy that forwards these paths and WebSocket connections. Production Compose binds to local port 8080 by default. Replace `example.com` in `index.html`, `public/robots.txt` and `public/sitemap.xml` with your own domain. See [architecture](ARCHITECTURE.md) and [developer notes](docs/ai/). The original automated deployment workflow is not included in this cleaned copy.
