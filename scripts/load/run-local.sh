#!/usr/bin/env bash
# Локальный прогон k6-нагрузки: поднимает временный Postgres + backend (с высоким
# rate-limit, чтобы мерить приложение, а не лимитер), запускает smoke.js, убирает за собой.
#
# Использование: bash scripts/load/run-local.sh
# Требует: postgresql@14 (brew), собранный backend (cargo build), k6.
set -u
PGBIN=/opt/homebrew/opt/postgresql@14/bin
PGPORT=55440
APIPORT=18090
DATADIR=$(mktemp -d /tmp/seguro_load_pg.XXXXXX)
ROOT=$(cd "$(dirname "$0")/../../backend" && pwd)
BIN=$ROOT/target/debug/seguro-backend
HASHBIN=$ROOT/target/debug/hash_password
LOG=/tmp/seguro_load_srv.log

cleanup() {
  [ -n "${SRV_PID:-}" ] && kill "$SRV_PID" 2>/dev/null
  "$PGBIN/pg_ctl" -D "$DATADIR" stop -m fast >/dev/null 2>&1
  rm -rf "$DATADIR"
}
trap cleanup EXIT

[ -x "$BIN" ] || { echo "backend не собран — выполните: (cd backend && cargo build)"; exit 1; }
command -v k6 >/dev/null 2>&1 || { echo "k6 не установлен — brew install k6"; exit 1; }

echo "== Postgres on $PGPORT =="
"$PGBIN/initdb" -D "$DATADIR" -U seguro --auth=trust >/dev/null 2>&1
"$PGBIN/pg_ctl" -D "$DATADIR" -o "-p $PGPORT -k $DATADIR" -l "$DATADIR/pg.log" -w start >/dev/null 2>&1
"$PGBIN/createdb" -h "$DATADIR" -p "$PGPORT" -U seguro seguro 2>/dev/null

echo "== backend on $APIPORT (rate-limit поднят) =="
DATABASE_URL="postgres://seguro@localhost:$PGPORT/seguro" \
PORT=$APIPORT \
JWT_SECRET="load-secret" \
MANAGER_PASSWORD_HASH="$("$HASHBIN" loadpass)" \
ALLOWED_ORIGINS="*" \
RATE_LIMIT_PER_MIN=1000000 \
RUST_LOG=warn \
"$BIN" >"$LOG" 2>&1 &
SRV_PID=$!
for i in $(seq 1 40); do curl -fs "http://localhost:$APIPORT/health" >/dev/null 2>&1 && break; sleep 0.25; done

echo "== k6 smoke =="
BASE_URL="http://localhost:$APIPORT" k6 run "$(dirname "$0")/smoke.js"
RC=$?
[ "$RC" -eq 0 ] || { echo "--- server log tail ---"; tail -15 "$LOG"; }
exit "$RC"
