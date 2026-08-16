import { useState } from 'react';
import { useApp, shortAddress } from '../context/AppContext';

function formatTime(at) {
  if (!at) return '—';
  const date = new Date(at);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function EventDetail({ label, value }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-ink-400">{label}</span>
      <span className="text-ink-900">{value}</span>
    </div>
  );
}

export default function EventFeed() {
  const { events } = useApp();
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-100 bg-white py-16 text-center">
        <div className="h-12 w-12 rounded-full bg-ink-50 flex items-center justify-center mb-4">
          <div className="h-4 w-4 rounded-sm border-2 border-ink-200" />
        </div>
        <p className="text-lg font-medium text-ink-900">No events yet</p>
        <p className="mt-2 max-w-sm text-sm text-ink-500">
          Make a donation or run the AI agent to see on-chain activity stream here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="relative border-l border-ink-100 pl-6 ml-4 space-y-12">
      {events.map((e, idx) => {
        const id = e.id ?? `${e.type}-${e.ledger}-${e.txHash}`;
        const isExpanded = expandedId === id;
        const isLatest = idx === 0;

        let title = '';
        let iconClass = '';
        if (e.type === 'deposit') {
          title = 'Donor deposited funds';
          iconClass = 'bg-ink-100 border-ink-200';
        } else if (e.type === 'donation') {
          title = 'Donor sent a classic payment';
          iconClass = 'bg-ink-100 border-ink-200';
        } else if (e.type === 'payout') {
          title = `The agent released funds for ${e.reason || 'aid'}`;
          iconClass = 'bg-coral/20 border-coral/40';
        }

        return (
          <div key={id} className="relative">
            {/* Timeline Dot */}
            <div
              className={`absolute -left-[31px] mt-1.5 h-3.5 w-3.5 rounded-full border-2 bg-white ${
                isLatest ? 'border-coral bg-coral/20' : iconClass
              } ring-4 ring-paper`}
            />

            <div className="group cursor-pointer" onClick={() => toggleExpand(id)}>
              <span className="sr-only">{e.type}</span>
              <div className="flex items-baseline gap-3">
                <h3 className={`text-lg font-semibold ${isLatest ? 'text-ink-900' : 'text-ink-700'}`}>
                  {title}
                </h3>
                <span className="font-mono text-xs text-ink-400">{formatTime(e.at)}</span>
              </div>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
                {e.amount} XLM
              </p>
              
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-medium text-ink-500 group-hover:text-ink-900 transition-colors">
                  {isExpanded ? 'Hide on-chain details' : 'View on-chain details'}
                </span>
                <svg className={`h-3 w-3 text-ink-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Expanded Mono Detail Panel (Machine Layer) */}
            {isExpanded && (
              <div className="mt-4 overflow-hidden rounded-xl bg-ink-50/50 p-5 font-mono text-[11px] animate-fade-up">
                <div className="space-y-1">
                  <EventDetail label="Event Type" value={e.type.toUpperCase()} />
                  {e.type === 'deposit' && (
                    <EventDetail label="From (Donor)" value={e.donor} />
                  )}
                  {e.type === 'donation' && (
                    <>
                      <EventDetail label="From" value={e.from} />
                      <EventDetail label="To" value={e.to} />
                    </>
                  )}
                  {e.type === 'payout' && (
                    <>
                      <EventDetail label="Authorized By (Agent)" value={e.agent} />
                      <EventDetail label="To (Beneficiary)" value={e.to} />
                    </>
                  )}
                  <EventDetail label="Ledger Seq" value={e.ledger || 'Simulated'} />
                  
                  {e.txHash && /^[A-Za-z0-9]+$/.test(e.txHash) && !e.txHash.startsWith('SIM') && (
                    <div className="mt-4 pt-4 border-t border-ink-100 flex justify-between items-center">
                      <span className="text-ink-400 text-[10px]">TRANSACTION HASH</span>
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-emerald hover:text-emerald/80 transition-colors"
                      >
                        {shortAddress(e.txHash, 12)}
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
