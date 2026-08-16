const STEPS = [
  { key: 'pending', label: 'Pending' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'simulating', label: 'Simulating' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'awaiting_signature', label: 'Awaiting sig' },
  { key: 'signed', label: 'Signed' },
  { key: 'broadcasting', label: 'Broadcasting' },
  { key: 'awaiting_confirmation', label: 'Confirming' },
  { key: 'success', label: 'Success' },
  { key: 'failed', label: 'Failed' },
];

const FAILED = 'failed';

export default function TransactionStatus({ status, hash, onRetry }) {
  if (!status) return null;

  const currentIndex = STEPS.findIndex((s) => s.key === status);
  const isFailed = status === FAILED;

  return (
    <div className="mt-4 rounded-xl border border-ink-800 bg-ink-950 p-5 shadow-inner" data-testid="tx-status">
      <div className="flex items-center justify-between border-b border-ink-800 pb-3">
        <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${isFailed ? 'text-coral' : 'text-emerald'}`}>
          {isFailed ? 'Transaction failed' : STEPS[currentIndex]?.label || status}
        </span>
        {hash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 font-mono text-[10px] text-ink-400 hover:text-white transition-colors"
          >
            TX: {hash.slice(0, 8)}…{hash.slice(-6)}
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1 ink-scrollbar">
        {STEPS.slice(0, STEPS.length - 1).map((step, i) => {
          const done = !isFailed && currentIndex > i;
          const active = !isFailed && currentIndex === i;
          return (
            <div key={step.key} className="flex items-center gap-1">
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border font-mono text-[9px] font-bold transition-all ${
                  active
                    ? 'animate-pulse border-emerald bg-emerald/20 text-emerald shadow-[0_0_8px_rgba(14,122,95,0.4)]'
                    : done
                      ? 'border-ink-600 bg-ink-800 text-ink-300'
                      : 'border-ink-800 bg-transparent text-ink-600'
                }`}
                title={step.label}
              >
                {done ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 2 && (
                <div className={`h-px w-3 shrink-0 transition-colors ${done ? 'bg-ink-600' : 'bg-ink-800'}`} />
              )}
            </div>
          );
        })}
      </div>

      {isFailed && onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 w-full rounded-lg border border-coral/30 bg-coral/10 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-coral transition-colors hover:bg-coral/20"
        >
          Retry
        </button>
      )}
    </div>
  );
}
