// In-memory cache for authorized agent lookups
const agentCache = new Map();
// High-level client for the AgentRegistry contract.
//
// Agent management (add/remove) requires the registry admin, which in live
// mode must be handled by the account that deployed the contract. The
// dashboard therefore keeps a locally-known agent list (mirroring the
// registry) for display, and performs real contract calls where possible.

import { CONFIG, isLive } from '../config';
import { simulation } from '../utils/simulation';
import * as stellar from '../utils/stellar';

export const registryClient = {
  isLive,

  isInitialized() {
    return simulation.isInitialized() || isLive();
  },

  /**
   * Locally-known agents (persisted). Merges the configured AI agent key.
   */
  listAgents() {
    const known = simulation.getAgents();
    if (CONFIG.agentPublicKey && !known.includes(CONFIG.agentPublicKey)) {
      return [CONFIG.agentPublicKey, ...known];
    }
    return known;
  },

  isAgent(agent) {
    return simulation.isAgent(agent);
  },

  /**
   * In simulation mode the registry is admin-less (any caller can manage) so
   * the demo works out of the box. In live mode this invokes the deployed
   * contract using the provided admin account.
   */
  async addAgent({ admin, agent, onStatus }) {
    if (!isLive()) {
      onStatus?.('simulating');
      await simulation.wait();
      simulation.addAgent(admin, agent);
      return { hash: null, success: true };
    }
    if (!admin) throw new Error('Connect the registry admin wallet to add agents.');
    const args = [stellar.scValAddress(admin), stellar.scValAddress(agent)];
    const res = await stellar.invokeContract({
      contractId: CONFIG.registryContractId,
      method: 'add_agent',
      args,
      source: admin,
      onStatus,
    });
    return { hash: res.hash, success: res.success };
  },

  async removeAgent({ admin, agent, onStatus }) {
    if (!isLive()) {
      onStatus?.('simulating');
      await simulation.wait();
      simulation.removeAgent(admin, agent);
      return { hash: null, success: true };
    }
    if (!admin) throw new Error('Connect the registry admin wallet to remove agents.');
    const args = [stellar.scValAddress(admin), stellar.scValAddress(agent)];
    const res = await stellar.invokeContract({
      contractId: CONFIG.registryContractId,
      method: 'remove_agent',
      args,
      source: admin,
      onStatus,
    });
    return { hash: res.hash, success: res.success };
  },

  /**
   * True on-chain read of agent authorization (used by the escrow contract
   * cross-contract call). In live mode this simulates the contract view.
   */
  async checkOnChain({ agent, source }) {
    if (!isLive()) return simulation.isAgent(agent);
    if (!source) throw new Error('Connect a wallet to check agent authorization.');
    const value = await stellar.readContract({
      contractId: CONFIG.registryContractId,
      method: 'is_agent',
      args: [stellar.scValAddress(agent)],
      source,
    });
    return Boolean(value);
  },
};
