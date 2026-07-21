# syntax=docker/dockerfile:1
# SBL — Elastic Beanstalk Docker image
# CodeBuild (buildspec.yml) builds the frontend into static/frontend before deploy.

FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=80

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY alembic.ini .
COPY alembic/ ./alembic/
COPY scripts/start.sh ./scripts/start.sh
COPY static/ ./static/

RUN chmod +x ./scripts/start.sh

EXPOSE 80

CMD ["./scripts/start.sh"]
