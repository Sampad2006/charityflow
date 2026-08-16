// Lightweight in-memory simulation of the CharityEscrow + AgentRegistry
// contracts. Used when no contract IDs are configured so the dashboard is
// fully interactive without a network. Mirrors the exact contract semantics:
// deposits, agent authorization, and payouts.
//
// Persisted to localStorage so the demo survives reloads.

const STORAGE_KEY = 'charityflow:simulation:v1';
import { CONFIG } from '../config';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class SimulationBackend {
  constructor() {
    this.listeners = new Set();
    this.hydrate();
  }

  hydrate() {
    const raw = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.balances = parsed.balances || {};
        this.agents = new Set(parsed.agents || []);
        this.admin = parsed.admin || null;
        this.events = parsed.events || [];
        this.nonce = parsed.nonce || 0;
        return;
      } catch (_err) {
        // fall through to a fresh state
      }
    }
    this.reset();
  }

  persist() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          balances: this.balances,
          agents: [...this.agents],
          admin: this.admin,
          events: this.events,
          nonce: this.nonce,
        })
      );
    }
  }

  reset() {
    this.balances = {};
    this.agents = new Set();
    this.admin = null;
    this.events = [];
    this.nonce = 0;
    // The configured AI agent is pre-registered so the out-of-the-box demo
    // flow (agent proposes → escrow disburses) works without setup.
    if (CONFIG.agentPublicKey) this.agents.add(CONFIG.agentPublicKey);
    this.persist();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(type, payload) {
    this.listeners.forEach((l) => l({ type, payload, at: Date.now() }));
  }

  // ───────────────────────────── ledger helpers ─────────────────────────────

  credit(address, amount) {
    this.balances[address] = (this.balances[address] || 0) + amount;
  }

  debit(address, amount) {
    const current = this.balances[address] || 0;
    if (current < amount) {
      throw new Error('insufficient_balance');
    }
    this.balances[address] = current - amount;
  }

  balanceOf(address) {
    return this.balances[address] || 0;
  }

  /**
   * Seeds a wallet's balance once. Used when a real wallet connects in
   * simulation mode so the simulated ledger mirrors reality, but never
   * overwrites a balance that the simulated ledger already tracks.
   */
  mirrorIfUnknown(address, amount) {
    if (this.balances[address] === undefined) {
      this.balances[address] = amount;
      this.persist();
    }
  }

  // ─────────────────────────────── registry ─────────────────────────────

  initialize(admin) {
    this.admin = admin;
    this.persist();
  }

  isInitialized() {
    return Boolean(this.admin);
  }

  addAgent(admin, agent) {
    if (admin !== this.admin) throw new Error('unauthorized');
    this.agents.add(agent);
    this.persist();
  }

  removeAgent(admin, agent) {
    if (admin !== this.admin) throw new Error('unauthorized');
    this.agents.delete(agent);
    this.persist();
  }

  isAgent(agent) {
    return this.agents.has(agent);
  }

  getAgents() {
    return [...this.agents];
  }

  // ──────────────────────────────── escrow ─────────────────────────────

  fund(address, amount) {
    this.credit(address, amount);
    this.persist();
  }

  async deposit(donor, amount) {
    if (amount <= 0) throw new Error('zero_amount');
    this.debit(donor, amount);
    this.credit('escrow', amount);
    const event = this.recordEvent('deposit', {
      donor,
      amount,
      status: 'success',
    });
    this.persist();
    return event;
  }

  async requestPayout(agent, to, amount, reason) {
    if (amount <= 0) throw new Error('zero_amount');
    if (!this.isAgent(agent)) throw new Error('unauthorized_agent');
    const balance = this.balanceOf('escrow');
    if (balance < amount) throw new Error('insufficient_funds');
    this.debit('escrow', amount);
    this.credit(to, amount);
    const event = this.recordEvent('payout', {
      agent,
      to,
      amount,
      reason,
      status: 'success',
    });
    this.persist();
    return event;
  }

  async sendXlmPayment(from, to, amount) {
    if (amount <= 0) throw new Error('zero_amount');
    this.debit(from, amount);
    this.credit(to, amount);
    const event = this.recordEvent('donation', {
      from,
      to,
      amount,
      status: 'success',
    });
    this.persist();
    return event;
  }

  escrowBalance() {
    return this.balanceOf('escrow');
  }

  // ──────────────────────────────── events ─────────────────────────────

  recordEvent(type, payload) {
    const event = {
      id: `sim_${++this.nonce}`,
      type,
      ...payload,
      hash: `SIM${String(this.nonce).padStart(14, '0')}`,
      at: new Date().toISOString(),
    };
    this.events.unshift(event);
    this.emit(type, event);
    return event;
  }

  getEvents(limit = 100) {
    return this.events.slice(0, limit);
  }

  getStats() {
    return {
      totalDeposited: this.events
        .filter((e) => e.type === 'deposit')
        .reduce((s, e) => s + e.amount, 0),
      totalDonated: this.events
        .filter((e) => e.type === 'donation')
        .reduce((s, e) => s + e.amount, 0),
      totalPayouts: this.events
        .filter((e) => e.type === 'payout')
        .reduce((s, e) => s + e.amount, 0),
      payoutCount: this.events.filter((e) => e.type === 'payout').length,
    };
  }

  // Small artificial latency so the UI lifecycle (pending → … → success) is
  // visible in the demo.
  async wait() {
    await sleep(600 + Math.random() * 500);
  }
}

export const simulation = new SimulationBackend();
export { sleep };
