#!/usr/bin/env bash
#
# One-command local E2E for ChainTrack.
#
#   bash contracts/scripts/e2e-local.sh
#
# Brings up: fresh Hardhat node -> seeds contract (deploy + wallets + users +
# seed package) -> builds the web app with the seeded address -> serves it ->
# CORS proxy -> headless Chrome + CDP -> runs contracts/scripts/e2e-ui.mjs.
# Then tears everything down and restores deployments.json so the repo stays
# Vercel-clean (empty deployment address).
#
# Exits non-zero on failure. Requires: pnpm, chromium, node >= 20 (WebSocket).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

WEB_PORT="${WEB_PORT:-3000}"
RPC_PORT="${RPC_PORT:-8545}"
PROXY_PORT="${PROXY_PORT:-8546}"
CDP_PORT="${CDP_PORT:-9224}"
CHROMIUM_BIN="${CHROMIUM_BIN:-chromium}"
PROFILE_DIR="${PROFILE_DIR:-$(mktemp -d /tmp/ct-e2e-profile.XXXXXX)}"

log() { printf '\n== %s ==\n' "$@"; }

for port in "$RPC_PORT" "$PROXY_PORT" "$WEB_PORT" "$CDP_PORT"; do
  if ss -ltn 2>/dev/null | grep -q ":$port\b"; then
    echo "Port $port is already in use — stop the process and re-run." >&2
    exit 1
  fi
done

cleanup() {
  set +e
  # Processes are started with `setsid`, so each lives in its own process
  # group id = <pid>; killing -pid reaps the whole tree (pnpm/node/chromium).
  for pg in "${PG_NODE:-}" "${PG_WEB:-}" "${PG_PROXY:-}" "${PG_CDP:-}"; do
    [ -n "$pg" ] && kill -TERM -- "-$pg" 2>/dev/null
  done
  sleep 1
  for pg in "${PG_NODE:-}" "${PG_WEB:-}" "${PG_CDP:-}"; do
    [ -n "$pg" ] && kill -KILL -- "-$pg" 2>/dev/null
  done
  git checkout -- web/src/contracts/deployments.json 2>/dev/null
  rm -rf "$PROFILE_DIR"
  log "cleaned up (deployments.json restored to committed state)"
}
trap cleanup EXIT

log "1/6  starting fresh Hardhat node on :$RPC_PORT"
setsid bash -c "cd contracts && pnpm exec hardhat node" > /tmp/ct-e2e-node.log 2>&1 &
PG_NODE=$!
for i in $(seq 1 30); do ss -ltn 2>/dev/null | grep -q ":$RPC_PORT\b" && break; sleep 1; done

log "2/6  seeding ChainTrack (deploy + wallets + users + seed package)"
pnpm --filter contracts seed

log "3/6  building web app with seeded deployment address"
pnpm --filter web build

log "4/6  serving web app on :$WEB_PORT and CORS proxy on :$PROXY_PORT"
setsid bash -c "cd web && PORT=$WEB_PORT pnpm start" > /tmp/ct-e2e-web.log 2>&1 &
PG_WEB=$!
setsid node contracts/scripts/cors-proxy.mjs > /tmp/ct-e2e-proxy.log 2>&1 &
PG_PROXY=$!
for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$WEB_PORT/" > /dev/null 2>&1 && break
  sleep 1
done

log "5/6  launching headless Chrome (CDP :$CDP_PORT)"
setsid "$CHROMIUM_BIN" --headless=new --disable-gpu --no-sandbox \
  --user-data-dir="$PROFILE_DIR" --remote-debugging-port="$CDP_PORT" \
  about:blank > /tmp/ct-e2e-cdp.log 2>&1 &
PG_CDP=$!
for i in $(seq 1 30); do curl -sf "http://127.0.0.1:$CDP_PORT/json/version" > /dev/null 2>&1 && break; sleep 1; done

log "6/6  running E2E"
BASE_URL="http://localhost:$WEB_PORT" CDP_PORT=$CDP_PORT RPC="http://127.0.0.1:$PROXY_PORT" \
  node contracts/scripts/e2e-ui.mjs