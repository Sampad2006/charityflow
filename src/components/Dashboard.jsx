import { useApp } from '../context/AppContext';
import { simulation } from '../utils/simulation';

export default function Dashboard() {
  const { mode, wallet, stats, escrowBalance, pushToast } = useApp();

  const fundDemo = async () => {
    if (!wallet.publicKey) {
      pushToast({ type: 'error', message: 'Connect a wallet first.' });
      return;
    }
    simulation.fund(wallet.publicKey, 100);
    pushToast({ type: 'success', message: '100 XLM demo funds credited.' });
  };

  return (
    <section className="mt-12 flex flex-col gap-12 lg:mt-24 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
      {/* Left: Narrative Hero (Human Layer) */}
      <div className="max-w-2xl lg:w-3/5">
        <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-ink-900">
          Donate.
          <br />
          The AI decides.
          <br />
          The ledger <span className="font-serif italic text-coral">proves</span> it.
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-500">
          Fund the humanitarian treasury. Our AI monitors global crisis feeds to deploy aid instantly where it’s needed most. Every payout is authorized and verifiable on-chain.
        </p>

        {mode === 'simulation' && (
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={fundDemo}
              disabled={!wallet.publicKey}
              className="rounded-full border border-ink-200 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-600 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-600"
            >
              +100 Demo Funds
            </button>
            {!wallet.publicKey && (
              <span className="text-xs text-ink-400">Connect wallet to fund demo</span>
            )}
          </div>
        )}
      </div>

      {/* Right: Receipt / Machine Layer */}
      <div className="w-full shrink-0 lg:w-[400px]">
        <div className="overflow-hidden rounded-2xl bg-ink-900 text-white shadow-2xl">
          <div className="border-b border-ink-800 p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-ink-400">
                Treasury Status
              </span>
              <div className="flex items-center gap-1.5 rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5">
                <span className="h-1.5 w-1.5 animate-pulse-subtle rounded-full bg-emerald" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-emerald">
                  Verified On-Chain
                </span>
              </div>
            </div>
            
            <div className="mt-6">
              <span className="block font-mono text-xs text-ink-400">Available for aid</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="font-mono text-4xl font-bold tracking-tight text-paper"
                  data-testid="escrow-balance"
                >
                  {escrowBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
                </span>
              </div>
            </div>
          </div>

          <div className="bg-ink-800/30 p-6">
            <ul className="space-y-3 font-mono text-xs">
              <li className="flex justify-between border-b border-ink-800 pb-2">
                <span className="text-ink-400">Total Donated</span>
                <span className="text-paper">{stats.totalDonated.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM</span>
              </li>
              <li className="flex justify-between border-b border-ink-800 pb-2">
                <span className="text-ink-400">Total Disbursed</span>
                <span className="text-paper">{stats.totalPayouts.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM</span>
              </li>
              <li className="flex justify-between">
                <span className="text-ink-400">Payouts Executed</span>
                <span className="text-paper">
                  {stats.payoutCount}
                  <span className="sr-only"> payout{stats.payoutCount === 1 ? '' : 's'} executed</span>
                </span>
              </li>
            </ul>
          </div>
          
          {/* Subtle grid/barcode decorative footer */}
          <div className="h-6 w-full opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #fff 2px, #fff 4px)', backgroundSize: '4px 100%' }} />
        </div>
      </div>
    </section>
  );
}
