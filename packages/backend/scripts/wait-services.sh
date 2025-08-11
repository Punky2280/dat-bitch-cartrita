#!/usr/bin/env bash
set -euo pipefail

PG_HOST=${POSTGRES_HOST:-localhost}
PG_PORT=${POSTGRES_PORT:-5432}
REDIS_HOST=${REDIS_HOST:-localhost}
REDIS_PORT=${REDIS_PORT:-6379}
MAX_WAIT=${MAX_WAIT_SECONDS:-60}
SLEEP=2

echo "[wait-services] Waiting for Postgres $PG_HOST:$PG_PORT and Redis $REDIS_HOST:$REDIS_PORT (timeout ${MAX_WAIT}s)"
start=$(date +%s)

function waited() {
  now=$(date +%s)
  echo $(( now - start ))
}

while true; do
  pg_ok=0
  redis_ok=0
  # Postgres check
  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h "$PG_HOST" -p "$PG_PORT" -t 2 >/dev/null 2>&1; then
      pg_ok=1
    fi
  else
    # fallback: attempt TCP connect
    (echo > /dev/tcp/$PG_HOST/$PG_PORT) >/dev/null 2>&1 && pg_ok=1 || true
  fi
  # Redis check
  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
      redis_ok=1
    fi
  else
    (echo > /dev/tcp/$REDIS_HOST/$REDIS_PORT) >/dev/null 2>&1 && redis_ok=1 || true
  fi

  if [[ $pg_ok -eq 1 && $redis_ok -eq 1 ]]; then
    echo "[wait-services] ✅ Postgres and Redis are ready (waited $(waited)s)"
    exit 0
  fi

  elapsed=$(waited)
  if (( elapsed >= MAX_WAIT )); then
    echo "[wait-services] ❌ Timeout after ${elapsed}s (pg_ok=$pg_ok redis_ok=$redis_ok)" >&2
    exit 1
  fi
  echo "[wait-services] ... still waiting (pg=$pg_ok redis=$redis_ok elapsed=${elapsed}s)"
  sleep $SLEEP
done
