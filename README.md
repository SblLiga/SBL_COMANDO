# SBL_COMANDO — Unified App + Infrastructure Monorepo

This repository now combines:

- Application runtime (`backend` + `frontend`) for Elastic Beanstalk deployment.
- Full infrastructure as code (`terraform`) for AWS RDS/EB/CodePipeline.
- Base44 exported app source in `base44-app` (kept as-is, not deleted from original repo).

## Repository Structure

```text
SBL_COMANDO/
├── backend/                 # FastAPI app packaged for EB
├── frontend/                # React app built into backend/static/frontend
├── terraform/               # Dev/Prod infrastructure
├── .github/workflows/       # dev/prod pipeline triggers
└── base44-app/              # Base44 exported app copy (EliteOrbit)
```

## Branch Strategy

- `dev` branch → DEV AWS environment and `sbl-dev-pipeline`.
- `prod` branch → PROD AWS environment and `sbl-prod-pipeline`.
- `main` branch remains the integration base.

`deploy-dev.yml` triggers on push to `dev`.  
`deploy-prod.yml` triggers on push to `prod`.

## Environment and Database Rules

- DEV keeps test/sample behavior for fast validation.
- PROD must use clean data only (no dummy/seed data) and secure secrets from AWS.
- App DB settings are environment-driven via `DB_*` variables.
- Migrations run on startup when `RUN_DB_MIGRATIONS=true`.

## Quick Start (DEV First)

```powershell
# 1) Infrastructure bootstrap parameters/secrets
cd terraform\scripts
.\bootstrap-dev.ps1

# 2) Provision DEV infra
cd ..\environments\dev
terraform init
terraform apply

# 3) Push app/infra code to trigger deployment pipeline
cd ..\..\..
git checkout dev
git push origin dev
```

## Deploy Trigger Workflows

- `.github/workflows/deploy-dev.yml` starts `sbl-dev-pipeline`.
- `.github/workflows/deploy-prod.yml` starts `sbl-prod-pipeline`.

Required GitHub secrets:

- `AWS_ROLE_ARN_DEV`
- `AWS_ROLE_ARN_PROD`

## Important Notes

- Never commit secrets, `.env`, tfstate, or credentials.
- Keep PROD data clean: no local test dumps and no mock seeds.
- Promote to PROD only after DEV health endpoint and core flows pass.
