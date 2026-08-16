import EventFeed from '../components/EventFeed';

export default function LedgerPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900">
          The Ledger of Good
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-500">
          Every deposit and disbursement is recorded immutably on the Stellar blockchain. Verify the flow of funds in real-time below.
        </p>
      </div>

      <section id="ledger" className="scroll-mt-20">
        <header className="mb-8 border-b border-ink-100 pb-4">
          <span className="font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
            02 — History
          </span>
          <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink-900">
            Live Event Feed
          </h2>
        </header>
        <EventFeed />
      </section>
    </div>
  );
}
