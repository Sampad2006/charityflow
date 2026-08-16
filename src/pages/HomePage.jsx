import Dashboard from '../components/Dashboard';
import EscrowConsole from '../components/EscrowConsole';

export default function HomePage() {
  return (
    <>
      <Dashboard />
      <div className="mt-24 space-y-32">
        <section id="donate" className="scroll-mt-20">
          <header className="mb-8 border-b border-ink-100 pb-4">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
              01 — Deposit
            </span>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink-900">
              Donate
            </h2>
          </header>
          <EscrowConsole />
        </section>
      </div>
    </>
  );
}
