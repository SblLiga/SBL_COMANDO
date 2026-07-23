# Architecture map — SBL_COMANDO

Non-destructive layout. Paths below are **CI-critical** where noted.

```text
SBL_COMANDO/
├── .cursor/rules/           # Cursor project rules (always-on)
├── .cursorrules             # Same conventions for agents / Cursor
├── .github/workflows/       # deploy-dev.yml / deploy-prod.yml → CodePipeline
├── docs/                    # Architecture & contributor maps (this folder)
│
├── backend/                 # ★ FastAPI API + Elastic Beanstalk Docker image
│   ├── app/                 #   routers, auth, models, bootstrap, health
│   ├── alembic/             #   DB migrations
│   ├── static/frontend/     #   built SPA (filled by CodeBuild; not edited by hand)
│   ├── buildspec.yml        #   ★ CodeBuild: builds base44-app → bundles here
│   ├── Dockerfile           #   ★ EB runtime
│   └── scripts/start.sh     #   migrations + gunicorn
│
├── base44-app/              # ★ LIVE React + Vite frontend (legacy folder name)
│   ├── public/              #   logo, favicons, manifest
│   ├── src/pages/           #   route screens
│   ├── src/components/      #   UI + domain components
│   ├── src/api/             #   apiClient → FastAPI
│   ├── src/lib/             #   AuthContext, mediaUrl, helpers
│   └── scripts/             #   asset helpers (e.g. gen_favicon.py)
│
├── frontend/                # Legacy minimal scaffold — DO NOT USE for features
├── terraform/               # AWS: EB, RDS, pipeline, IAM (dev + prod)
├── docker-compose.yml       # Local: Postgres + backend
├── .env.example             # Root env template
└── README.md                # Developer & DevOps manual
```

## Runtime (DEV)

```text
Browser  →  EB (FastAPI serves SPA + /api/* + /api/media/*)
                └─ RDS PostgreSQL (users, goals, media_assets, …)
```

## Naming note

`base44-app/` is **not** Base44 SaaS anymore. The name is kept only so `backend/buildspec.yml` keeps working. Treat it as “the SBL web app”.
