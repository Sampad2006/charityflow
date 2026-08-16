# CharityFlow

Decentralized AI-driven aid allocation on Stellar (Soroban).

Donors fund a **CharityEscrow** Soroban contract. A registered **AI agent** analyzes crisis
feeds and proposes transparent, auditable disbursements — every action recorded as an on-chain
event. Access control lives in a second contract, **AgentRegistry**, which the escrow calls
cross-contract before any payout.

## Features

- **Level 1 — Donations:** classic XLM payments *and* native Soroban deposits into the escrow.
- **Level 2 — AI disbursal:** the agent proposes payout params; only addresses registered in the
  `AgentRegistry` can disburse (`is_agent` cross-contract check). Insufficient escrow/donor
  balance is handled and surfaced.
- **Level 3 — Transparency & automation:** event streaming (Deposit/Payout/Donation) with a live
  feed, per-step transaction lifecycle UI (pending → signed → broadcasted → success/failed),
  and an optional Gemini integration for real AI reasoning.
- **Multi-wallet:** Freighter, Albedo, Hana, and Rabet via `@creit.tech/stellar-wallets-kit`.
- **Simulation mode:** runs out of the box with zero configuration (no contracts deployed, no
  wallet extensions) — ideal for demos and tests.
- **Dark premium UI:** Tailwind CSS, glassmorphism, gradient accents.

## Architecture

```
src/
├── config.js                 # Env-driven configuration + live/simulation switch
├── context/AppContext.jsx    # Global state (wallet, escrow, events, toasts)
├── components/               # WalletConnect, Dashboard, EscrowConsole,
│                             # CrisisSimulation, AgentsPanel, EventFeed, ...
├── contracts/escrowClient.js     # Unified escrow interface (sim + live)
├── contracts/registryClient.js   # Unified registry interface (sim + live)
└── utils/
    ├── stellar.js            # Wallets Kit, Horizon, Soroban RPC, tx lifecycle
    ├── simulation.js         # In-browser Soroban simulator (localStorage)
    └── gemini.js             # AI agent (Gemini API + rule-based fallback)

contracts/
├── agent-registry/           # AgentRegistry Soroban contract
└── charity-escrow/           # CharityEscrow Soroban contract (16 tests)
```

## Quick start (simulation mode — no setup)

```bash
npm install
npm run dev
```

Open the app, click **Connect Wallet** (a real testnet wallet is still used as your donor
identity), and:

1. **Donate** — `Operations Console → Donate`.
2. **Run the AI agent** — pick a scenario in the Crisis Simulator, review its proposal.
3. **Approve & disburse** — watch the payout land in the live event feed.

> Tip: the "＋100 XLM demo funds" button on the Dashboard credits your simulated wallet.

## Live testnet mode

### Prerequisites
- The `stellar` CLI (v27+): `curl -fsSL https://deb.nodesource.com/setup_... | sh` or
  `cargo install stellar-cli --locked` (a `stellar` binary is already available on this machine).
- A **testnet wallet** funded with test XLM. Fund any address via the friendbot:
  `curl "https://friendbot.stellar.org?addr=<G...>"`, or in the
  [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test).
- `testnet` network already configured: `stellar network ls` should list it.

### 1. Build the contracts

```bash
cd contracts
stellar contract build          # run inside contracts/agent-registry
stellar contract build          # run inside contracts/charity-escrow
```

> The escrow crate imports the registry's wasm spec via `contractimport!`
> (`contracts/charity-escrow/specs/agent_registry.wasm`). If you change the
> **registry** contract, rebuild it and re-copy the wasm:
> `cp target/wasm32v1-none/release/agent_registry.wasm charity-escrow/specs/`

### 2. Deploy the contracts

Set `SOURCE` to your funded wallet's **secret key** and run:

```bash
cd contracts

# Deploy AgentRegistry
stellar contract deploy \
  --wasm target/wasm32v1-none/release/agent_registry.wasm \
  --source-account "$SOURCE" \
  --network testnet \
  --alias agent-registry
# → prints C...AGENT_REGISTRY_ID

# Deploy CharityEscrow
stellar contract deploy \
  --wasm target/wasm32v1-none/release/charity_escrow.wasm \
  --source-account "$SOURCE" \
  --network testnet \
  --alias charity-escrow
# → prints C...CHARITY_ESCROW_ID
```

The contract IDs are also saved as aliases — `stellar contract id --alias agent-registry`
and `stellar contract id --alias charity-escrow` recall them anytime.

### 3. Initialize

```bash
REGISTRY=$(stellar contract id --alias agent-registry)
ESCROW=$(stellar contract id --alias charity-escrow)
XLM_TOKEN=$(stellar contract id asset --asset native --network testnet)
ADMIN=<your testnet G... public key>

# Init the registry (admin = you)
stellar contract invoke --id "$REGISTRY" --source-account "$SOURCE" --network testnet \
  -- initialize --admin "$ADMIN"

# Register the AI agent so it may disburse
stellar contract invoke --id "$REGISTRY" --source-account "$SOURCE" --network testnet \
  -- add_agent --admin "$ADMIN" --agent GCYXK5W4GFXTILMV3RHAB37ED26RRXY3RKXY5VDE5Y7VT53U3ZQPU7HQ

# Init the escrow bound to the registry + the native XLM asset contract
stellar contract invoke --id "$ESCROW" --source-account "$SOURCE" --network testnet \
  -- initialize --admin "$ADMIN" --registry "$REGISTRY" --token "$XLM_TOKEN"
```

### 4. Point the dashboard at them

```bash
cp .env.example .env
```

```bash
VITE_REGISTRY_CONTRACT_ID=C...AGENT_REGISTRY_ID
VITE_ESCROW_CONTRACT_ID=C...CHARITY_ESCROW_ID
```

Start `npm run dev` — the header badge switches from **Simulation** to **Live Testnet**.
Donations invoke `deposit` on-chain; the AI agent's payouts are signed locally with the
demo agent key and authorized by the registry cross-contract call.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_HORIZON_URL` | testnet Horizon | Classic transaction/balance reads |
| `VITE_SOROBAN_RPC_URL` | testnet RPC | Soroban simulations, invocations, events |
| `VITE_NETWORK_PASSPHRASE` | testnet | Network passphrase for signing |
| `VITE_REGISTRY_CONTRACT_ID` | — | AgentRegistry contract id (`C...`) |
| `VITE_ESCROW_CONTRACT_ID` | — | CharityEscrow contract id (`C...`) |
| `VITE_ESCROW_WALLET` | — | Destination for classic XLM donations |
| `VITE_AGENT_PUBLIC_KEY` | demo keypair | The AI agent's signer address |
| `VITE_AGENT_SECRET_KEY` | demo keypair | Demo-only agent signing (never use in prod) |
| `VITE_NGO_WALLET` | demo NGO | Default payout recipient |
| `VITE_GEMINI_API_KEY` | — | Enables Gemini agent; otherwise rule-based |

## Tests

```bash
npm run test:contracts   # Rust: 6 registry + 10 escrow tests
npm test                 # Vitest: frontend flows (connect → donate → AI → disburse)
npm run lint             # ESLint (flat config)
npm run build            # Production build
```

## Security notes

- The demo agent keypair is for **testnet development only**. In production the agent signs
  server-side and the secret key never touches the browser.
- Payout authorization is enforced on-chain by the `AgentRegistry` — a compromised frontend
  cannot authorize a payout.

## License

MIT
