import { useState, useEffect } from 'react';
import { runAIAgent, SCENARIOS } from '../utils/gemini';
import { useApp, shortAddress } from '../context/AppContext';
import { CONFIG } from '../config';
import TransactionStatus from './TransactionStatus';

function PayoutArc({ amount, from, to }) {
  const [drawn, setDrawn] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDrawn(true);
      // Simple count up animation
      let start = 0;
      const end = parseFloat(amount);
      const duration = 1000;
      const step = 30;
      const increment = end / (duration / step);
      const counter = setInterval(() => {
        start += increment;
        if (start >= end) {
          setDisplayAmount(end);
          clearInterval(counter);
        } else {
          setDisplayAmount(start);
        }
      }, step);
      return () => clearInterval(counter);
    }, 100);
    return () => clearTimeout(timer);
  }, [amount]);

  return (
    <div className="relative mt-8 flex flex-col items-center py-8">
      <div className="flex w-full items-center justify-between px-8 relative z-10">
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-800 text-xs font-bold text-ink-300">
            ESCROW
          </div>
          <span className="mt-2 font-mono text-[10px] text-ink-500">{shortAddress(from, 6)}</span>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="font-mono text-xl font-bold text-coral">
            {displayAmount.toFixed(1)} XLM
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-400">
            Verified Transfer
          </span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-coral/20 text-xs font-bold text-coral">
            NGO
          </div>
          <span className="mt-2 font-mono text-[10px] text-ink-500">{shortAddress(to, 6)}</span>
        </div>
      </div>

      <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none">
        <path
          d="M 80 60 Q 50% -20, calc(100% - 80) 60"
          fill="none"
          stroke="rgba(224, 82, 62, 0.2)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <path
          d="M 80 60 Q 50% -20, calc(100% - 80) 60"
          fill="none"
          stroke="#E0523E"
          strokeWidth="2"
          strokeDasharray="1000"
          strokeDashoffset={drawn ? "0" : "1000"}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
    </div>
  );
}

export default function CrisisSimulation() {
  const { escrowBalance, disburse, pushToast } = useApp();
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const [feed, setFeed] = useState(SCENARIOS[0].text);
  const [thinking, setThinking] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [tx, setTx] = useState(null);
  const [busy, setBusy] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');

  const selectScenario = (s) => {
    setSelectedId(s.id);
    setFeed(s.text);
    setProposal(null);
    setTx(null);
    setPayoutAmount('');
  };

  const runAgent = async () => {
    if (!feed.trim()) return;
    setThinking(true);
    setProposal(null);
    setTx(null);
    try {
      const result = await runAIAgent(feed, {
        escrowBalance,
        ngoWallet: CONFIG.ngoWallet,
      });
      setProposal(result);
      setPayoutAmount(result.params.amount);
    } catch (err) {
      pushToast({ type: 'error', message: `Agent failed: ${err.message}` });
    } finally {
      setThinking(false);
    }
  };

  const approve = async () => {
    if (!proposal) return;
    const amount = Number(payoutAmount);
    if (!(amount > 0)) {
      pushToast({ type: 'error', message: 'Enter a valid disbursement amount greater than 0.' });
      return;
    }
    if (amount > escrowBalance) {
      pushToast({
        type: 'error',
        message: `Insufficient escrow balance: request ${amount} XLM but escrow holds ${escrowBalance} XLM.`,
      });
      return;
    }
    setTx({ status: 'pending' });
    setBusy(true);
    try {
      const res = await disburse({
        to: proposal.params.recipient,
        amount,
        reason: proposal.params.reason,
        onStatus: (s) => setTx({ status: s }),
      });
      setTx((t) => ({ ...t, status: 'success', hash: res.hash }));
      pushToast({
        type: 'success',
        message: `AI disbursed ${amount} XLM for ${proposal.params.region}.`,
      });
    } catch (err) {
      setTx((t) => ({ ...t, status: 'failed', error: err.message }));
      pushToast({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl bg-ink-900 shadow-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Input Panel */}
        <div className="border-b border-ink-800 p-8 lg:border-b-0 lg:border-r">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
              Intelligence Input
            </h3>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-800 text-[10px] font-bold text-ink-400">
              AI
            </span>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectScenario(s)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedId === s.id
                      ? 'border-ink-600 bg-ink-800 text-white'
                      : 'border-ink-800 bg-transparent text-ink-500 hover:border-ink-700 hover:text-ink-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="font-mono text-xs text-ink-500">{s.severity}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                Raw Crisis Feed
              </label>
              <textarea
                value={feed}
                onChange={(e) => setFeed(e.target.value)}
                rows={5}
                className="ink-scrollbar w-full resize-none rounded-xl border border-ink-700 bg-ink-950 p-4 font-mono text-xs leading-relaxed text-ink-200 placeholder-ink-700 focus:border-ink-500 focus:outline-none focus:ring-1 focus:ring-ink-500"
                data-testid="crisis-feed"
              />
            </div>

            <button
              onClick={runAgent}
              disabled={thinking || !feed.trim()}
              data-testid="run-agent"
              className="w-full rounded-xl bg-coral py-3 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-50 disabled:hover:scale-100"
            >
              {thinking ? 'Agent deliberating...' : 'Analyze & Propose'}
            </button>
          </div>
        </div>

        {/* Right: Deliberation Panel (Machine output) */}
        <div className="bg-ink-950 p-8">
          <h3 className="mb-6 font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
            Deliberation Log
          </h3>

          {!thinking && !proposal && (
            <div className="flex h-64 flex-col items-center justify-center text-center text-ink-600">
              <div className="mb-4 font-mono text-2xl">_</div>
              <p className="text-sm">Awaiting crisis data...</p>
            </div>
          )}

          {thinking && (
            <div className="space-y-4 font-mono text-xs text-ink-400">
              <p className="animate-pulse">Initializing inference engine...</p>
              <div className="space-y-2 pl-4 border-l border-ink-800">
                <p>1. Analyzing severity & regional needs</p>
                <p>2. Querying on-chain escrow balance</p>
                <p>3. Drafting payout parameters</p>
              </div>
              <p className="animate-pulse">Awaiting final proposal signature...</p>
            </div>
          )}

          {proposal && !thinking && (
            <div className="animate-fade-up space-y-6" data-testid="agent-proposal">
              {/* Proposal Header */}
              <div className="flex items-center justify-between border-b border-ink-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-coral/20 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-coral">
                    {proposal.source === 'gemini' ? 'Gemini' : 'Rules'}
                  </span>
                  <span className="font-mono text-xs text-ink-300">
                    {proposal.params.crisisType}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                  {proposal.params.region}
                </span>
              </div>

              {/* Reasoning */}
              <div className="rounded-lg bg-ink-900 p-4 font-mono text-xs leading-relaxed text-ink-300">
                <span className="mb-2 block text-[10px] uppercase text-ink-500">Reasoning</span>
                {proposal.reasoning}
              </div>

              {/* Param Inputs for Test IDs (hidden visually, but present in DOM) */}
              <input type="hidden" data-testid="payout-to" value={proposal.params.recipient} />
              <input type="hidden" data-testid="payout-reason" value={proposal.params.reason} />

              {/* The Payout Moment */}
              {proposal.params.amount > 0 ? (
                <>
                  <PayoutArc 
                    amount={Number(payoutAmount) || 0} 
                    from={CONFIG.escrowContractId || 'C_ESCROW...'} 
                    to={proposal.params.recipient} 
                  />

                  <div className="mt-8 space-y-4 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                      Reason: {proposal.params.reason}
                    </p>

                    <div className="space-y-2 text-left">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="payout-amount"
                          className="font-mono text-[10px] uppercase tracking-widest text-ink-500"
                        >
                          Disbursement Amount
                        </label>
                        <span className="font-mono text-[10px] text-ink-500">
                          Available: {escrowBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
                        </span>
                      </div>
                      <input
                        id="payout-amount"
                        type="number"
                        min="0"
                        max={escrowBalance}
                        step="any"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        data-testid="payout-amount"
                        className="w-full rounded-xl border border-ink-700 bg-ink-950 p-3 text-center font-mono text-lg font-bold text-white focus:border-coral focus:outline-none focus:ring-1 focus:ring-coral"
                      />
                      {Number(payoutAmount) > escrowBalance && (
                        <p className="text-xs font-medium text-coral">
                          Amount exceeds the available escrow balance ({escrowBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM).
                        </p>
                      )}
                    </div>

                    <button
                      onClick={approve}
                      disabled={busy || !(Number(payoutAmount) > 0) || Number(payoutAmount) > escrowBalance}
                      data-testid="approve-payout"
                      className="w-full rounded-xl bg-white py-4 text-sm font-bold text-ink-900 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {busy ? 'Signing...' : 'Authorize Payout On-Chain'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-amber/30 bg-amber/10 p-4 text-center text-xs font-medium text-amber">
                  The escrow holds 0 XLM. Aid cannot be disbursed.
                </div>
              )}

              {tx && <div className="mt-6"><TransactionStatus status={tx.status} hash={tx.hash} /></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
