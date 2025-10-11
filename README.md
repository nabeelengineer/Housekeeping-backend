# Housekeeping App

This document is shared between the frontend and backend repos. It describes the overall system, features, local setup, and Docker notes.

For backend specifics, see `../README.md`.

## Features
- Buy/Sell marketplace for employees
- Vehicle rental and logs
- Notifications and moderation
- IT Admin Logs (assets created/assigned/returned) with export

## Repository Structure (monorepo view)
```
Housekeeping/
├─ Housekeeping-backend/         # Node.js (Express, Sequelize, MySQL)
├─ Housekeeping-frontend/        # React + Vite + MUI + React Query
├─ docs/
│  └─ er-diagram.mmd             # Mermaid ER diagram
└─ README-architecture.md        # Deep-dive on modules and flows
```

If using split repos, this document is duplicated under `docs/` in each repo.

## Tech Stack
- Backend: Node.js, Express, Sequelize (MySQL)
- Frontend: React (Vite), Material UI, React Query, React Router
- Auth: JWT-based via middleware
- Deploy: Dockerfiles for backend and frontend (Nginx)

## Local Setup
### Backend
```bash
npm install
npm run dev  # or: node src/index.js
```
The server listens on `PORT` (default 4000). On first start it may run `sequelize.sync()` to create missing tables.

### Frontend
See the frontend repo `README.md` for setup. API base URL via `VITE_API_BASE_URL`.

## Docker (build separately)
### Backend
```bash
docker build -t housekeeping-backend .
docker run -d --name housekeeping-backend \
  -p 4000:4000 \
  --env-file ./.env \
  housekeeping-backend
```

### Frontend (served by Nginx)
```bash
# build with API base URL
docker build -t housekeeping-frontend \
  --build-arg VITE_API_BASE_URL=http://localhost:4000 .
# run
# docker run -d --name housekeeping-frontend -p 5173:80 housekeeping-frontend
```

## Environment Variables (backend)
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
- JWT_SECRET
- CORS_ORIGIN (e.g. http://localhost:5173)

## Key Endpoints (high level)
- IT Admin Logs:
  - `GET /api/assets/admin/summary`
  - `GET /api/assignments/admin/logs`
- Market (buy/sell), Vehicles, Notifications — see backend README for full listing.

## ER Diagram
See `docs/er-diagram.mmd` and the architecture doc `README-architecture.md`.
