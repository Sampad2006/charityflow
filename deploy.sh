#!/usr/bin/env bash
#
# Builds, deploys, and initializes the CharityFlow contracts on Stellar
# testnet. Reads SOURCE_SECRET / ADMIN_PUBLIC_KEY from `.env` and writes the
# resulting contract IDs back into `.env` for the Vite app.
#
# Usage:
#   bash deploy.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS="$ROOT/contracts"
ENV_FILE="$ROOT/.env"

# Load deployment vars from .env (VITE_* lines are harmless when sourced).
# shellcheck disable=SC1090
source "$ENV_FILE"

if [ -z "${SOURCE_SECRET:-}" ] || [ -z "${ADMIN_PUBLIC_KEY:-}" ]; then
  echo "❌ Set SOURCE_SECRET and ADMIN_PUBLIC_KEY in .env first." >&2
  exit 1
fi

AGENT="GCYXK5W4GFXTILMV3RHAB37ED26RRXY3RKXY5VDE5Y7VT53U3ZQPU7HQ"
NETWORK="testnet"
WASM_DIR="$CONTRACTS/target/wasm32v1-none/release"

echo "▸ Funding testnet wallet (idempotent)…"
curl -sS "https://friendbot.stellar.org?addr=$ADMIN_PUBLIC_KEY" >/dev/null || true

echo "▸ Building contracts…"
( cd "$CONTRACTS/agent-registry" && stellar -q contract build >/dev/null )
cp "$WASM_DIR/agent_registry.wasm" "$CONTRACTS/charity-escrow/specs/agent_registry.wasm"
( cd "$CONTRACTS/charity-escrow" && stellar -q contract build >/dev/null )

echo "▸ Deploying AgentRegistry…"
stellar contract deploy \
  --wasm "$WASM_DIR/agent_registry.wasm" \
  --source-account "$SOURCE_SECRET" \
  --network "$NETWORK" \
  --alias agent-registry
REGISTRY="$(stellar contract alias show agent-registry)"

echo "▸ Deploying CharityEscrow…"
stellar contract deploy \
  --wasm "$WASM_DIR/charity_escrow.wasm" \
  --source-account "$SOURCE_SECRET" \
  --network "$NETWORK" \
  --alias charity-escrow
ESCROW="$(stellar contract alias show charity-escrow)"

echo "▸ Resolving native XLM asset contract…"
XLM_TOKEN="$(stellar contract id asset --asset native --network "$NETWORK")"

echo "▸ Initializing AgentRegistry (admin: $ADMIN_PUBLIC_KEY)…"
stellar contract invoke \
  --id "$REGISTRY" --source-account "$SOURCE_SECRET" --network "$NETWORK" \
  -- initialize --admin "$ADMIN_PUBLIC_KEY"

echo "▸ Registering AI agent: $AGENT"
stellar contract invoke \
  --id "$REGISTRY" --source-account "$SOURCE_SECRET" --network "$NETWORK" \
  -- add_agent --admin "$ADMIN_PUBLIC_KEY" --agent "$AGENT"

echo "▸ Initializing CharityEscrow (registry + native token)…"
stellar contract invoke \
  --id "$ESCROW" --source-account "$SOURCE_SECRET" --network "$NETWORK" \
  -- initialize --admin "$ADMIN_PUBLIC_KEY" --registry "$REGISTRY" --token "$XLM_TOKEN"

# Write contract IDs back into .env for the Vite app.
echo "▸ Writing contract IDs into .env…"
"$ROOT/scripts/set-env" \
  VITE_REGISTRY_CONTRACT_ID="$REGISTRY" \
  VITE_ESCROW_CONTRACT_ID="$ESCROW"

echo ""
echo "✅ Live testnet deployment complete!"
echo "   Registry: $REGISTRY"
echo "   Escrow:   $ESCROW"
echo "   XLM token: $XLM_TOKEN"
echo ""
echo "   Next: npm run dev  → header badge should show 'Live Testnet'"
