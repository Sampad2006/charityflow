import { useState } from 'react';
import { useApp, shortAddress } from '../context/AppContext';
import { simulation } from '../utils/simulation';
import { CONFIG } from '../config';
import { registryClient } from '../contracts/registryClient';

export default function AgentsPanel() {
  const { agents, wallet, addAgent, removeAgent, pushToast } = useApp();
  const [newAgent, setNewAgent] = useState('');
  const [busy, setBusy] = useState(false);

  const initialized = registryClient.isInitialized();

  const initializeRegistry = async () => {
    if (!wallet.publicKey) {
      pushToast({ type: 'error', message: 'Connect a wallet to become the registry admin.' });
      return;
    }
    simulation.initialize(wallet.publicKey);
    pushToast({ type: 'success', message: 'AgentRegistry initialized — you are the admin.' });
  };

  const handleAdd = async () => {
    const agent = newAgent.trim();
    if (!agent) return;
    setBusy(true);
    try {
      await addAgent({ agent });
      setNewAgent('');
    } catch (err) {
      pushToast({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (agent) => {
    setBusy(true);
    try {
      await removeAgent({ agent });
    } catch (err) {
      pushToast({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="mb-8 text-lg text-ink-500 leading-relaxed">
        Only addresses registered here may disburse from the escrow. The cross-contract{' '}
        <code className="font-mono text-sm text-ink-900 bg-ink-50 px-1.5 py-0.5 rounded">is_agent</code>{' '}
        check enforces this on-chain.
      </p>

      {!initialized && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber/20 bg-amber/5 p-6">
          <p className="text-sm font-medium text-amber">
            Registry not initialized. The connected wallet becomes the admin.
          </p>
          <button
            onClick={initializeRegistry}
            className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Initialize
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-sm">
        <ul className="divide-y divide-ink-100">
          {agents.map((agent) => {
            const isAI = agent === CONFIG.agentPublicKey;
            return (
              <li
                key={agent}
                className="flex items-center justify-between bg-white p-5 transition-colors hover:bg-ink-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-ink-900">{shortAddress(agent, 10)}</span>
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-emerald">
                        Verified
                      </span>
                    </div>
                    {isAI && (
                      <span className="rounded-full bg-ink-900 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                        AI Agent
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-ink-400">{agent}</p>
                </div>
                <button
                  onClick={() => handleRemove(agent)}
                  disabled={busy || !wallet.publicKey}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-400 transition-colors hover:bg-coral/10 hover:text-coral disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            );
          })}
          {agents.length === 0 && (
            <li className="p-8 text-center text-sm font-medium text-ink-400">
              No agents registered yet.
            </li>
          )}
        </ul>

        <div className="border-t border-ink-100 bg-ink-50 p-5">
          <div className="flex gap-3">
            <input
              type="text"
              value={newAgent}
              onChange={(e) => setNewAgent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="G... or C... address to register"
              className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2 font-mono text-sm text-ink-900 placeholder-ink-400 outline-none transition-colors focus:border-ink-900 focus:ring-1 focus:ring-ink-900"
            />
            <button
              onClick={handleAdd}
              disabled={busy || !wallet.publicKey || !newAgent.trim()}
              className="rounded-xl bg-ink-900 px-5 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-40"
            >
              Add agent
            </button>
          </div>
          {!wallet.publicKey && (
            <p className="mt-2 text-xs font-medium text-amber">Connect a wallet to manage the registry.</p>
          )}
        </div>
      </div>
    </div>
  );
}
