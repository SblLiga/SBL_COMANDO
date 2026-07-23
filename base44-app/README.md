# SBL Web Application (`base44-app/`)

> **Folder name is legacy.** This is the live React + Vite app for שולי בן לולו.  
> Do **not** rename without updating `backend/buildspec.yml` (CI copies `base44-app/`).

## Local development

```powershell
copy .env.example .env.local
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:8000` in `.env.local` when the backend runs via root `docker-compose.yml`.

## Layout

| Path | Purpose |
|------|---------|
| `src/pages/` | Route screens |
| `src/components/` | Shared UI |
| `src/api/apiClient.js` | REST → FastAPI `/api/*` |
| `src/lib/` | Auth, media URLs, helpers |
| `public/` | Brand assets (logo, favicons, manifest) |

## Brand / tab icon

Favicons are generated from `public/logo.png` via `scripts/gen_favicon.py`.

## Build

Production builds are produced by `backend/buildspec.yml` during CodePipeline.
