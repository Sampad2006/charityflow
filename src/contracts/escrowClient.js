// High-level client for the CharityEscrow contract.
//
// Unifies SIMULATION MODE (no contracts configured) and LIVE TESTNET MODE
// (real Soroban invocations) behind a single async interface so the UI code
// stays identical.

import { CONFIG, isLive } from '../config';
import { simulation } from '../utils/simulation';
import * as stellar from '../utils/stellar';

const normalizeAmount = (value) => {
  let num = 0;
  if (typeof value === 'bigint') num = Number(value);
  else if (typeof value === 'number') num = value;
  else if (value && typeof value === 'object') {
    const v = value.value ?? value.low ?? value.amount;
    num = Number(v);
  } else {
    num = Number(value ?? 0);
  }
  return num / 1e7; // Convert stroops to XLM
};

function normalizeLiveEvent(event) {
  const topic = event.topic || [];
  const value = event.value || {};
  const name = topic[0];
  switch (name) {
    case 'deposit': {
      const donor = typeof topic[1] === 'string' ? topic[1] : topic[1]?.toString?.() ?? '';
      return {
        type: 'deposit',
        donor,
        amount: normalizeAmount(value.amount),
        ledger: event.ledger,
        txHash: event.txHash,
      };
    }
    case 'payout': {
      const to = typeof topic[1] === 'string' ? topic[1] : topic[1]?.toString?.() ?? '';
      const reason = typeof topic[2] === 'string' ? topic[2] : String(topic[2] ?? '');
      return {
        type: 'payout',
        to,
        reason,
        amount: normalizeAmount(value.amount),
        ledger: event.ledger,
        txHash: event.txHash,
      };
    }
    default:
      return { type: String(name ?? 'unknown'), ...event };
  }
}

export const escrowClient = {
  isLive,

  async escrowBalance({ source } = {}) {
    if (!isLive()) return simulation.escrowBalance();
    if (!source) throw new Error('Connect a wallet to read the live escrow balance.');
    const value = await stellar.readContract({
      contractId: CONFIG.escrowContractId,
      method: 'escrow_balance',
      args: [],
      source,
    });
    return normalizeAmount(value);
  },

  /**
   * Contract-native deposit (donor → escrow token balance).
   */
  async deposit({ donor, amount, source, onStatus }) {
    if (!isLive()) {
      onStatus?.('simulating');
      await simulation.wait();
      return { hash: null, event: await simulation.deposit(donor, amount), success: true };
    }
    if (!source) throw new Error('Connect a wallet to make a deposit.');
    const args = [stellar.scValAddress(donor), stellar.scValAmount(amount)];
    const res = await stellar.invokeContract({
      contractId: CONFIG.escrowContractId,
      method: 'deposit',
      args,
      source,
      onStatus,
    });
    return { hash: res.hash, success: res.success, txResult: res.result };
  },

  /**
   * Classic XLM payment (Level 1 manual donation) to the escrow account.
   */
  async sendDonation({ from, to, amount, onStatus }) {
    if (!isLive()) {
      onStatus?.('simulating');
      await simulation.wait();
      return { hash: null, event: await simulation.sendXlmPayment(from, to, amount), success: true };
    }
    if (!from) throw new Error('Connect a wallet to send a donation.');
    return stellar.sendXlmPayment({ from, to, amount, onStatus });
  },

  /**
   * AI-agent disbursal. Authorized by the AgentRegistry cross-contract call.
   */
  async requestPayout({ agent, to, amount, reason, onStatus }) {
    if (!isLive()) {
      onStatus?.('simulating');
      await simulation.wait();
      return {
        hash: null,
        event: await simulation.requestPayout(agent, to, amount, reason),
        success: true,
      };
    }
    const args = [
      stellar.scValAddress(agent),
      stellar.scValAddress(to),
      stellar.scValAmount(amount),
      stellar.scValSymbol(reason),
    ];
    const res = await stellar.invokeContract({
      contractId: CONFIG.escrowContractId,
      method: 'request_payout',
      args,
      source: agent,
      secretKey: CONFIG.agentSecretKey || undefined,
      onStatus,
    });
    return { hash: res.hash, success: res.success, txResult: res.result };
  },

  stats() {
    return simulation.getStats();
  },

  history(limit = 100) {
    return simulation.getEvents(limit);
  },

  subscribe(cb) {
    return simulation.subscribe(cb);
  },

  /**
   * Watches for contract events. In live mode this polls Soroban RPC; in
   * simulation mode it subscribes to the local ledger. Returns an unsubscribe
   * function.
   */
  watchEvents(cb, { intervalMs = 5000 } = {}) {
    if (!isLive()) return simulation.subscribe(cb);

    let running = true;
    let latestLedger = -1;
    let timer = null;

    const poll = async () => {
      try {
        const { events, latestLedger: ll } = await stellar.fetchContractEvents({
          contractId: CONFIG.escrowContractId,
          startLedger: latestLedger + 1,
        });
        if (events.length) latestLedger = ll;
        for (const e of events) {
          cb(normalizeLiveEvent(e));
        }
      } catch (_err) {
        // transient RPC errors are ignored; the poller retries
      }
      if (running) timer = setTimeout(poll, intervalMs);
    };

    poll();
    return () => {
      running = false;
      if (timer) clearTimeout(timer);
    };
  },
};
