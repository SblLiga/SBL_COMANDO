#!/bin/sh
set -eu

PORT="${PORT:-80}"

if [ "${RUN_DB_MIGRATIONS:-true}" = "true" ]; then
  echo "Running database migrations..."
  alembic upgrade head
fi

exec gunicorn \
  -k uvicorn.workers.UvicornWorker \
  -b "0.0.0.0:${PORT}" \
  app.main:app \
  --timeout 120
