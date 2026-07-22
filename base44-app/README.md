# SBL Web Application

React + Vite frontend for the SBL platform. All auth and data requests go to the self-hosted FastAPI backend (`/api/*`).

## Local development

```powershell
copy .env.example .env.local
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:8000` in `.env.local` when running the backend via Docker Compose.

## Build

```powershell
npm run build
```

Production builds are produced automatically by `backend/buildspec.yml` during CodePipeline deployment.

## API client

- `src/api/apiClient.js` — REST client for auth, entities, and file uploads
- `src/lib/AuthContext.jsx` — session state and route guards
