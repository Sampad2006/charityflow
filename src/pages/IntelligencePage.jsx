import CrisisSimulation from '../components/CrisisSimulation';
import AgentsPanel from '../components/AgentsPanel';

export default function IntelligencePage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900">
          AI Intelligence
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-500">
          Humanitarian payouts are exclusively proposed by authorized AI agents evaluating real-time crisis data.
        </p>
      </div>

      <div className="space-y-32">
        <section id="agent" className="scroll-mt-20">
          <header className="mb-8 border-b border-ink-100 pb-4">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
              03 — Intelligence
            </span>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink-900">
              Ask the Agent
            </h2>
          </header>
          <CrisisSimulation />
        </section>

        <section id="registry" className="scroll-mt-20">
          <header className="mb-8 border-b border-ink-100 pb-4">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
              04 — Authorization
            </span>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink-900">
              Who may disburse
            </h2>
          </header>
          <AgentsPanel />
        </section>
      </div>
    </div>
  );
}
