#!/usr/bin/env bash
# 로컬 Supabase 스택(supabase start)에 마이그레이션 + 시드를 적용하고 서버 시나리오 테스트를 돌린다.
#   npm run db:test
# Supabase 없이 순정 Postgres 로만 검증하려면: PGURL=postgres://... ./scripts/verify.sh --shim
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--shim" ]]; then
  : "${PGURL:?PGURL 이 필요합니다 (예: postgres://postgres@localhost:5432/xoeat)}"
  psql -v ON_ERROR_STOP=1 -q "$PGURL" -f scripts/_local_shim.sql
  for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q "$PGURL" -f "$f"; done
  psql -v ON_ERROR_STOP=1 -q "$PGURL" -f supabase/seed.sql
else
  supabase db reset
  PGURL="postgres://postgres:postgres@127.0.0.1:54322/postgres"
fi

psql -v ON_ERROR_STOP=1 "$PGURL" -f scripts/test.sql
