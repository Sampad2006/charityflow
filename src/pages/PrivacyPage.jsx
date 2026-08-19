import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[800px] space-y-12">
      {/* Header */}
      <div className="space-y-4 border-b border-ink-100 pb-8">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="font-mono text-xs uppercase tracking-widest text-ink-400 hover:text-ink-900 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
          Privacy Policy
        </h1>
        <p className="font-serif text-lg italic text-ink-500">
          Transparent, non-custodial data practices for decentralized aid allocation.
        </p>
        <p className="font-mono text-xs uppercase tracking-widest text-ink-400">
          Last Updated: August 2026 · Protocol Version 1.0.0
        </p>
      </div>

      {/* Content Sections */}
      <div className="space-y-8 text-sm leading-relaxed text-ink-700">
        <section className="space-y-3 rounded-2xl border border-ink-100 bg-paper p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-ink-900">1. Non-Custodial Architecture</h2>
          <p>
            CharityFlow is a decentralized, non-custodial application on the Stellar network. We never have access to,
            store, or transmit your private keys, seed phrases, or wallet passwords. All cryptographic signing operations
            occur strictly within your connected wallet provider (e.g. Freighter, Albedo, Hana, or Rabet).
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-ink-100 bg-paper p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-ink-900">2. Blockchain & Public Ledger Data</h2>
          <p>
            When you deposit into the <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-800">CharityEscrow</code> contract
            or disburse funds, your public Stellar address, transaction hash, timestamp, and amount are recorded
            immutably on the public Stellar testnet/mainnet ledger. This public ledger data is accessible to anyone
            via blockchain explorers such as Stellar Expert.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-ink-100 bg-paper p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-ink-900">3. Local Browser Storage</h2>
          <p>
            In Simulation Mode, mock transactions, demo ledger entries, and local agent registries are persisted exclusively
            within your browser&apos;s <code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs text-ink-800">localStorage</code>. This data never leaves your device and can be cleared at any time through your browser settings.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-ink-100 bg-paper p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-ink-900">4. AI Agent & External APIs</h2>
          <p>
            Our AI Crisis Agent evaluates global emergency reports using the Google Gemini API or deterministic offline rule sets.
            No personal information, private keys, or wallet credentials are ever passed into the AI evaluation prompts.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-ink-100 bg-paper p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-ink-900">5. Anonymous Telemetry</h2>
          <p>
            CharityFlow collects zero tracking cookies and no personally identifiable information (PII). Minimal client-side
            event logs are used strictly for in-session UI responsiveness and error boundary recovery.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-ink-100 bg-paper p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold text-ink-900">6. Open Source Codebase</h2>
          <p>
            The entire CharityFlow protocol, smart contracts, and web client are fully open source and verifiable on GitHub at{' '}
            <a
              href="https://github.com/Sampad2006/charityflow"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-coral underline hover:text-ink-900"
            >
              github.com/Sampad2006/charityflow
            </a>.
          </p>
        </section>
      </div>

      <div className="pt-4 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-paper shadow-md transition-all hover:bg-ink-800 active:scale-95"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
