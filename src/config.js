// Centralized configuration for the CharityFlow dashboard.
//
// Values are read from Vite environment variables (`.env`), with sensible
// defaults so the app runs out of the box in SIMULATION MODE.
//
// Switch to LIVE TESTNET MODE by setting `VITE_REGISTRY_CONTRACT_ID` and
// `VITE_ESCROW_CONTRACT_ID` (see `.env.example`).

// Demo AI-agent keypair used ONLY for local development/demos on testnet.
// In production the agent lives server-side and signs via its own wallet.
export const DEMO_AGENT = {
  publicKey: 'GCYXK5W4GFXTILMV3RHAB37ED26RRXY3RKXY5VDE5Y7VT53U3ZQPU7HQ',
  secretKey: 'SA6V7XU56334AXWB7VPUHCXLH6APRDPOPOMNHO5XSFG7JJ2VHHEXM5VT',
};

export const CONFIG = {
  horizonUrl: import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  rpcUrl: import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    import.meta.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  registryContractId: import.meta.env.VITE_REGISTRY_CONTRACT_ID || '',
  escrowContractId: import.meta.env.VITE_ESCROW_CONTRACT_ID || '',
  escrowWallet: import.meta.env.VITE_ESCROW_WALLET || '',
  agentPublicKey: import.meta.env.VITE_AGENT_PUBLIC_KEY || DEMO_AGENT.publicKey,
  agentSecretKey: import.meta.env.VITE_AGENT_SECRET_KEY || DEMO_AGENT.secretKey,
  ngoWallet:
    import.meta.env.VITE_NGO_WALLET || 'GBPH6W2GR5QPSWJIJUJEHLQP3G7AISRJTRSIDOQKNUSOJOXW37BEPLBU',
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  geminiModel: import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash',
};

/**
 * Whether the app is running against deployed Soroban contracts on live
 * testnet, or in local simulation mode.
 */
export function isLive() {
  return Boolean(CONFIG.registryContractId && CONFIG.escrowContractId);
}

export function explorerUrl(hash) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function accountUrl(address) {
  return `https://stellar.expert/explorer/testnet/account/${address}`;
}
