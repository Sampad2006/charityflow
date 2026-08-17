// Stellar wallet + SDK integration for CharityFlow.
//
// - Multi-wallet support through `@creit.tech/stellar-wallets-kit` v2
//   (Freighter, Albedo, Hana, Rabet).
// - Classic Stellar transactions (payments) via Horizon.
// - Soroban smart-contract invocations via the RPC server.
// - Transaction lifecycle callbacks (pending → signed → broadcasted →
//   success/failed) for the UI.
import {
  StellarWalletsKit,
  Networks,
  KitEventType,
  SwkAppDarkTheme,
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
import { RabetModule } from '@creit.tech/stellar-wallets-kit/modules/rabet';
import {
  Horizon,
  rpc,
  TransactionBuilder,
  Networks as SdkNetworks,
  BASE_FEE,
  Contract,
  nativeToScVal,
  scValToNative,
  Keypair,
  Asset,
  Operation,
  Address as SdkAddress,
} from '@stellar/stellar-sdk';
import { CONFIG } from '../config';

const PASS = CONFIG.networkPassphrase || SdkNetworks.TESTNET;

let kitInitialized = false;

// ─────────────────────────────── wallet kit ───────────────────────────────

/**
 * Initializes (once) the Stellar Wallets Kit with the supported modules.
 * Accepts `{ networkPassphrase }` so tests can override the network.
 */
export function initKit({ networkPassphrase = PASS } = {}) {
  if (!kitInitialized) {
    StellarWalletsKit.init({
      modules: [new FreighterModule(), new AlbedoModule(), new HanaModule(), new RabetModule()],
      network: networkPassphrase === SdkNetworks.PUBLIC ? Networks.PUBLIC : Networks.TESTNET,
      theme: SwkAppDarkTheme,
    });
    kitInitialized = true;
  }
  return StellarWalletsKit;
}

/**
 * Opens the wallet selector modal and resolves with the connected public key.
 *
 * @throws {{ code: number, message: string }} with a normalized error code:
 *   - -1  user closed the modal / cancelled
 *   - -2  wallet not found (not installed)
 *   - -3  no wallet selected
 */
export async function connectWallet(walletId) {
  const kit = initKit();
  try {
    if (walletId) {
      kit.setWallet(walletId);
      const { address: publicKey } = await kit.fetchAddress();
      if (!publicKey) throw { code: -3, message: 'No wallet was selected.' };
      return publicKey;
    }
    const { address } = await kit.authModal();
    if (!address) throw { code: -3, message: 'No wallet was selected.' };
    return address;
  } catch (err) {
    throw normalizeWalletError(err);
  }
}

export function normalizeWalletError(err) {
  const code = err?.code ?? -1;
  const message = err?.message || err?.error?.message || String(err);
  const lower = `${message} ${code}`.toLowerCase();

  if (lower.includes('closed') || lower.includes('cancel') || code === -1) {
    return { code: -1, message: 'Wallet connection was cancelled.' };
  }
  if (lower.includes('not found') || lower.includes('not installed') || lower.includes('install')) {
    return { code: -2, message: 'Wallet not found. Please install the extension first.' };
  }
  if (code === -3) {
    return { code: -3, message: 'No wallet was selected.' };
  }
  return { code, message };
}

export async function disconnectWallet() {
  initKit();
  try {
    await StellarWalletsKit.disconnect();
  } catch (_err) {
    // ignore — the kit clears in-memory state either way
  }
}

/**
 * Lists supported wallets with availability flags + install URLs.
 */
export async function listWallets() {
  initKit();
  const wallets = await StellarWalletsKit.refreshSupportedWallets();
  return wallets.map((w) => ({
    id: w.id,
    name: w.name,
    icon: w.icon,
    url: w.url,
    isAvailable: w.isAvailable,
  }));
}

export function onWalletStateChange(cb) {
  initKit();
  return StellarWalletsKit.on(KitEventType.STATE_UPDATED, cb);
}

export function onWalletDisconnect(cb) {
  initKit();
  return StellarWalletsKit.on(KitEventType.DISCONNECT, cb);
}

// ─────────────────────────────── SDK servers ───────────────────────────────

export function getHorizon() {
  return new Horizon.Server(CONFIG.horizonUrl);
}

export function getRpc() {
  return new rpc.Server(CONFIG.rpcUrl);
}

// ─────────────────────────────── accounts ───────────────────────────────

/**
 * Fetches the native XLM balance (as a number) and the full balance list.
 */
export async function fetchBalances(publicKey) {
  const horizon = getHorizon();
  const account = await horizon.loadAccount(publicKey);
  const balances = account.balances.map((b) => ({
    assetType: b.asset_type,
    code: b.asset_code || 'XLM',
    issuer: b.asset_issuer || '',
    balance: b.balance,
  }));
  const native = balances.find((b) => b.assetType === 'native');
  return { balances, nativeBalance: native ? parseFloat(native.balance) : 0 };
}

// ─────────────────────────────── signing ───────────────────────────────

/**
 * Signs an XDR envelope. Prefers an explicit demo secret key (dev/demo agent
 * payouts); otherwise delegates to the connected wallet.
 */
export async function signWithWallet(txXdr, { secretKey } = {}) {
  if (secretKey) {
    const kp = Keypair.fromSecret(secretKey);
    const tx = TransactionBuilder.fromXDR(txXdr, PASS);
    tx.sign(kp);
    return tx.toXDR();
  }
  initKit();
  const result = await StellarWalletsKit.signTransaction(txXdr, { networkPassphrase: PASS });
  return typeof result === 'string' ? result : result?.signedTxXdr;
}

// ─────────────────────────────── classic txns ───────────────────────────────

/**
 * Sends a classic XLM payment (Level 1 manual donation).
 */
export async function sendXlmPayment({ from, to, amount, onStatus }) {
  const horizon = getHorizon();
  onStatus?.('drafting');
  const account = await horizon.loadAccount(from);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASS,
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset: Asset.native(),
        amount: amount.toFixed(7),
      })
    )
    .setTimeout(30)
    .build();

  onStatus?.('awaiting_signature');
  const signedXdr = await signWithWallet(tx.toXDR());
  onStatus?.('signed');

  const signedTx = TransactionBuilder.fromXDR(signedXdr, PASS);
  onStatus?.('broadcasting');
  const res = await horizon.submitTransaction(signedTx);
  onStatus?.('success');
  return { hash: res.hash };
}

// ─────────────────────────────── Soroban ───────────────────────────────

async function pollTransaction(server, hash, onStatus) {
  const deadline = Date.now() + 90_000;
  let last;
  while (Date.now() < deadline) {
    try {
      const result = await server.getTransaction(hash);
      if (result.status === 'SUCCESS') {
        onStatus?.('success');
        return { hash, success: true, result };
      }
      if (result.status === 'FAILED') {
        onStatus?.('failed');
        return { hash, success: false, result };
      }
      last = result.status;
    } catch (_err) {
      last = 'waiting';
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  onStatus?.('failed');
  throw new Error(`Transaction ${hash} timed out (last status: ${last ?? 'unknown'}).`);
}

/**
 * Invokes a Soroban contract method (write) and follows the full lifecycle.
 *
 * @param {object} opts
 * @param {string} opts.contractId - deployed contract address (C-form)
 * @param {string} opts.method - contract function name
 * @param {Array} opts.args - pre-built ScVal arguments
 * @param {string} opts.source - account that pays fees / signs
 * @param {string} [opts.secretKey] - optional demo secret key (skips wallet UI)
 * @param {(status: string) => void} [opts.onStatus]
 */
export async function invokeContract({ contractId, method, args, source, secretKey, onStatus }) {
  const server = getRpc();
  onStatus?.('drafting');
  const account = await server.getAccount(source);

  const contract = new Contract(contractId);
  const call = contract.call(method, ...args);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASS,
  })
    .addOperation(call)
    .setTimeout(30)
    .build();

  onStatus?.('simulating');
  const simulation = await server.simulateTransaction(tx);
  if (simulation.error) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  onStatus?.('preparing');
  const assembled = await server.prepareTransaction(tx, PASS);

  onStatus?.('awaiting_signature');
  const signedXdr = await signWithWallet(assembled.toXDR(), { secretKey });
  onStatus?.('signed');

  const signedTx = TransactionBuilder.fromXDR(signedXdr, PASS);
  onStatus?.('broadcasting');
  const resp = await server.sendTransaction(signedTx);
  if (resp.status === 'ERROR' || !resp.hash) {
    throw new Error(resp.errorResultXdr ? 'Transaction rejected by the network.' : 'Broadcast failed.');
  }

  onStatus?.('awaiting_confirmation');
  return pollTransaction(server, resp.hash, onStatus);
}

/**
 * Read-only contract view via simulation. `source` must be an existing
 * account; falls back to simulating without auth.
 */
export async function readContract({ contractId, method, args, source }) {
  const server = getRpc();
  const account = await server.getAccount(source);
  const contract = new Contract(contractId);
  const call = contract.call(method, ...args);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASS,
  })
    .addOperation(call)
    .setTimeout(0)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!sim.result) {
    throw new Error(sim.error || 'Contract read failed.');
  }
  return scValToNative(sim.result.retval);
}

/**
 * Polls Soroban RPC for contract events starting from `startLedger`.
 * Returns `{ events, latestLedger }` where events are decoded with
 * `scValToNative`.
 */
export async function fetchContractEvents({ contractId, startLedger = -1, limit = 50 }) {
  const server = getRpc();
  
  // If startLedger is invalid, fetch the current latest ledger to start polling from
  if (startLedger <= 0) {
    const latest = await server.getLatestLedger();
    startLedger = Math.max(1, latest.sequence - 2000); // look back roughly 3 hours on testnet
  }

  const res = await server.getEvents({
    startLedger,
    limit,
    filters: [{ type: 'contract', contractIds: [contractId] }],
  });
  const events = (res.events || []).map((e) => {
    let topic;
    let value;
    try {
      topic = (e.topic || []).map((t) => scValToNative(t));
      value = e.value !== undefined ? scValToNative(e.value) : null;
    } catch (_err) {
      topic = e.topic || [];
      value = e.value;
    }
    return { ...e, topic, value };
  });
  return { events, latestLedger: res.latestLedger };
}

// ─────────────────────────────── ScVal builders ───────────────────────────────

export function scValAddress(address) {
  return new SdkAddress(address).toScVal();
}

export function scValAmount(amount) {
  // Convert XLM to stroops (1 XLM = 10,000,000 stroops)
  return nativeToScVal(BigInt(Math.trunc(Number(amount) * 1e7)), { type: 'i128' });
}

export function scValSymbol(symbol) {
  return nativeToScVal(symbol, { type: 'symbol' });
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Parse error codes from Soroban RPC responses into human readable text
export function parseRpcErrorMessage(err) {
  if (!err) return 'Unknown transaction error';
  const msg = err.message || String(err);
  if (msg.includes('HostError') || msg.includes('Error(Contract')) {
    return 'Smart contract rejected the transaction (authorization or balance issue).';
  }
  if (msg.includes('User declined') || msg.includes('rejected')) {
    return 'Transaction rejected by user in wallet.';
  }
  return msg;
}
