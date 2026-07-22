# SBL_COMANDO — Developer & DevOps Manual

Unified monorepo for the SBL platform: application code, AWS infrastructure (Terraform), and CI/CD automation.

| Item | Value |
|------|-------|
| **GitHub** | `SblLiga/SBL_COMANDO` |
| **AWS Region** | `us-east-1` (N. Virginia) |
| **Compute** | Elastic Beanstalk (Docker, single container) |
| **Database** | RDS PostgreSQL 15 |
| **CI/CD** | GitHub Actions → CodePipeline → CodeBuild → Elastic Beanstalk |

---

## 1. Project Overview

### Architecture

```text
Developer push (dev/prod)
        │
        ▼
GitHub Actions (OIDC)
  deploy-dev.yml / deploy-prod.yml
        │
        ▼
AWS CodePipeline
  Source → Build → Deploy
        │
        ├─ CodeBuild (backend/buildspec.yml)
        │    ├─ Build frontend from base44-app/
        │    ├─ Bundle into backend/static/frontend
        │    └─ Package Docker backend artifact
        │
        ▼
Elastic Beanstalk (Docker)
        │
        ▼
RDS PostgreSQL
```

### Important design notes

- **GitHub Actions do not build Docker images directly.** They only trigger AWS CodePipeline.
- **ECR is not used** in the current deployment path. The backend is deployed as an Elastic Beanstalk Docker application version.
- **Self-hosted auth & data** — JWT auth + PostgreSQL via FastAPI (`/api/auth/*`, `/api/entities/*`). No external SaaS runtime.
- **Database bootstrap is environment-aware:**
  - `dev` → seeds sample users/goals for testing
  - `prod` → schema only + secure admin from secrets (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)

---

## 2. Repository Structure

```text
SBL_COMANDO/
├── backend/                 # FastAPI API + EB Docker image
│   ├── app/                 # Application code (config, models, bootstrap, health)
│   ├── alembic/             # Database migrations
│   ├── buildspec.yml        # AWS CodeBuild instructions
│   ├── Dockerfile           # EB runtime image
│   └── scripts/start.sh     # Container startup (migrations + gunicorn)
├── frontend/                # Minimal React scaffold (fallback)
├── base44-app/              # SBL web application (React + Vite)
│   ├── src/api/apiClient.js # Self-hosted REST client → FastAPI /api/*
├── terraform/               # AWS infrastructure (dev + prod)
│   ├── environments/dev/
│   ├── environments/prod/
│   └── scripts/             # One-time SSM bootstrap scripts
├── .github/workflows/       # Pipeline trigger workflows
├── docker-compose.yml       # Local backend + PostgreSQL
└── .env.example             # Environment variable template
```

### Branch strategy

| Branch | Purpose | AWS Pipeline | EB Environment |
|--------|---------|--------------|----------------|
| `main` | Integration / stable base | — | — |
| `dev` | Development deployments | `sbl-dev-pipeline` | `sbl-dev` |
| `prod` | Production deployments | `sbl-prod-pipeline` | `sbl-prod` |

| Workflow | Trigger | Secret required |
|----------|---------|-----------------|
| `deploy-dev.yml` | push to `dev` | `AWS_ROLE_ARN_DEV` |
| `deploy-prod.yml` | push to `prod` | `AWS_ROLE_ARN_PROD` |

---

## 3. Local Development Setup

### Option A — Docker Compose (recommended for backend validation)

```powershell
cd SBL_COMANDO
docker compose up --build
```

Verify:

```powershell
Invoke-RestMethod http://localhost:8000/health
Invoke-RestMethod http://localhost:8000/health/validate
```

Default local DB:

- Host: `localhost:5432`
- DB: `sbl_dev`
- User: `sbl_admin`
- Password: `devpassword`

DEV seed users (created on first startup):

| Email | Password | Role |
|-------|----------|------|
| `admin.dev@sbl.local` | `Admin123!` | admin |
| `manager.dev@sbl.local` | `Manager123!` | manager |
| `user.dev@sbl.local` | `User123!` | user |

### Option B — Full stack UI locally

```powershell
# Terminal 1 — backend
docker compose up --build

# Terminal 2 — frontend
cd base44-app
copy .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend calls `http://localhost:8000/api/*` via `VITE_API_URL`.

### Option C — Manual backend without Docker

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env with your local Postgres credentials
uvicorn app.main:app --reload --port 8000
```

---

## 4. Environment Variables & Secrets

### Application variables

| Variable | DEV | PROD | Description |
|----------|-----|------|-------------|
| `APP_ENV` | `dev` | `prod` | Environment mode |
| `DB_HOST` | RDS endpoint | RDS endpoint | Injected by Terraform/SSM |
| `DB_NAME` | `sbl_dev` | `sbl_prod` | Database name |
| `DB_USER` | `sbl_admin` | `sbl_admin` | DB username |
| `DB_PASSWORD` | Secrets Manager | Secrets Manager | Never commit |
| `DB_SSLMODE` | `require` (cloud) | `require` | SSL mode for RDS |
| `RUN_DB_MIGRATIONS` | `true` | `true` | Run Alembic on startup |
| `SEED_DEV_DATA` | `true` | `false` | DEV-only sample data |
| `ADMIN_EMAIL` | — | required | PROD admin bootstrap |
| `ADMIN_PASSWORD` | — | required | PROD admin bootstrap |
| `JWT_SECRET` | set locally | AWS secret | Auth signing key |

### GitHub repository secrets (manual setup)

| Secret | Used by |
|--------|---------|
| `AWS_ROLE_ARN_DEV` | `deploy-dev.yml` |
| `AWS_ROLE_ARN_PROD` | `deploy-prod.yml` |

### AWS SSM parameters (created by bootstrap scripts)

Under `/sbl/dev` or `/sbl/prod`:

- `pipeline/source_repo` → `SblLiga/SBL_COMANDO`
- `pipeline/frontend_repo` → `SblLiga/SBL_COMANDO`
- `pipeline/codestar_connection_arn`
- `pipeline/artifact_bucket_name`
- `eb/solution_stack_name`
- `app/app_env`, `app/log_level`

RDS credentials are created automatically by Terraform in **AWS Secrets Manager**.

---

## 5. Deployment & CI/CD Guide

### DEV deployment flow

1. Push code to `dev` branch
2. GitHub Actions runs `deploy-dev.yml`
3. Action assumes AWS OIDC role (`AWS_ROLE_ARN_DEV`)
4. Starts `sbl-dev-pipeline`
5. CodePipeline stages:
   - **Source** — pulls `SblLiga/SBL_COMANDO@dev` via CodeStar Connection
   - **Build** — CodeBuild runs `backend/buildspec.yml`
   - **Deploy** — updates Elastic Beanstalk environment `sbl-dev`

### PROD deployment flow

Same as DEV, but:

- Branch: `prod`
- Workflow: `deploy-prod.yml`
- Secret: `AWS_ROLE_ARN_PROD`
- Pipeline: `sbl-prod-pipeline`
- Environment: `sbl-prod`
- No seed data; admin created only from secure env vars

### First-time infrastructure setup

```powershell
# DEV bootstrap (SSM parameters)
cd terraform\scripts
.\bootstrap-dev.ps1

# DEV infrastructure
cd ..\environments\dev
terraform init
terraform plan
terraform apply

# Trigger first deployment
cd ..\..\..
git checkout dev
git push origin dev
```

### PROD infrastructure (after DEV is validated)

```powershell
cd terraform\scripts
.\bootstrap-prod.ps1

cd ..\environments\prod
terraform init
terraform apply

git checkout prod
git merge dev   # or cherry-pick tested commits
git push origin prod
```

---

## API Architecture

| Layer | Endpoint prefix | Purpose |
|-------|-----------------|---------|
| Auth | `/api/auth/*` | Login, register, OTP, JWT session, password reset |
| Entities | `/api/entities/{name}/*` | CRUD for User, Member, Group, Goal, Task, etc. |
| Upload | `/api/integrations/core/upload-file` | Profile images and attachments |

---

## 6. Health & Validation API

### `GET /health` — quick check

```powershell
Invoke-RestMethod https://<eb-url>/health
```

Example response:

```json
{
  "status": "ok",
  "environment": "dev",
  "mode": "development",
  "database": {
    "connected": true,
    "responsive": true,
    "latency_ms": 8.42,
    "error": null
  },
  "bootstrap": {
    "seed_dev_data_enabled": true
  }
}
```

### `GET /health/validate` — detailed check

Includes table counts (`users`, `admins`, `groups`, `goals`).

```powershell
Invoke-RestMethod https://<eb-url>/health/validate
```

Expected in PROD after bootstrap:

- `mode`: `"production"`
- `users`: `1` (admin only)
- `goals`: `0`

---

## 7. Pre-Deployment Audit Checklist

### Repository (done in code)

- [x] Unified monorepo structure
- [x] `dev` / `prod` branch workflows
- [x] Environment-based DB bootstrap
- [x] Buildspec uses `base44-app` as primary frontend
- [x] Bootstrap scripts point to `SblLiga/SBL_COMANDO`
- [x] Local `docker-compose.yml` for backend testing

### Manual steps (you must do)

- [ ] AWS CLI configured (`aws sts get-caller-identity`)
- [ ] CodeStar Connection to GitHub is **Available** in AWS Console
- [ ] Run `terraform\scripts\bootstrap-dev.ps1`
- [ ] Run `terraform apply` in `terraform\environments\dev`
- [ ] Create GitHub OIDC IAM roles in AWS for DEV/PROD
- [ ] Add `AWS_ROLE_ARN_DEV` and `AWS_ROLE_ARN_PROD` in GitHub Secrets
- [ ] (PROD) Store `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET` in AWS Secrets/SSM
- [ ] Push to `dev` and verify CodePipeline succeeds
- [ ] Verify `/health` and `/health/validate` on EB URL

### Optional hardening (recommended)

- [ ] Enable branch protection on `prod` (require PR + reviews)
- [ ] Enable branch protection on `dev` (require PR for merges from `main`)
- [ ] Configure GitHub Environment `production` with required reviewers

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Repository not found` on git clone | Wrong GitHub account/token | `gh auth switch -u SblLiga` |
| GitHub Action fails on OIDC | Missing/incorrect `AWS_ROLE_ARN_*` | Fix IAM role trust + secret |
| CodeBuild cannot find frontend | Wrong branch or repo in SSM | Re-run bootstrap script |
| `/health` returns 503 | RDS not reachable or migrations failed | Check EB env vars + RDS SG |
| PROD has seed data | `APP_ENV` not `prod` or `SEED_DEV_DATA=true` | Fix EB env + redeploy |

---

## 9. Related Repositories

| Repo | Purpose |
|------|---------|
| `SblLiga/SBL_COMANDO` | **Primary** — unified app + infra |
| `SblLiga/SBL-ALLAPP` | Infrastructure archive (kept, not deleted) |
| `SblLiga/eliteorbit` | Legacy source archive (historical reference only) |

---

<p align="center"><strong>SBL_COMANDO · AWS us-east-1 · Terraform · Elastic Beanstalk · RDS · CodePipeline</strong></p>
