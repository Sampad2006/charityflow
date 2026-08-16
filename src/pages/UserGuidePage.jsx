export default function UserGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-16">
      <header className="border-b border-ink-100 pb-12">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
          How CharityFlow Works
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-ink-500">
          CharityFlow replaces bureaucratic overhead with mathematical certainty. We use AI to decide where help is needed, and the Stellar blockchain to prove the money actually got there.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold text-ink-900">
          The Architecture of Trust
        </h2>
        <div className="prose prose-ink max-w-none text-ink-600">
          <p>
            Traditional charities ask for blind trust. You donate, and hopefully, the funds reach the intended crisis. CharityFlow is built on a &ldquo;trustless&rdquo; architecture using <strong>Soroban Smart Contracts</strong> on the Stellar network.
          </p>
          <p>
            When you donate, your funds don&apos;t go to a bank account controlled by humans. Instead, they are deposited directly into a decentralized <strong>Escrow Contract</strong>. The rules of this contract are public, immutable, and enforced by the network itself.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="font-display text-2xl font-bold text-ink-900">
          The AI Intelligence Layer
        </h2>
        <div className="prose prose-ink max-w-none text-ink-600">
          <p>
            The funds in the escrow cannot be touched—except by authorized AI Agents. These agents constantly monitor real-world crisis data feeds (like disaster reports, weather anomalies, and conflict zones).
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 pl-4 marker:text-emerald">
            <li><strong>Analyze:</strong> The AI evaluates the severity of the crisis.</li>
            <li><strong>Propose:</strong> If aid is justified, the AI generates a mathematical proof of need and proposes a payout.</li>
            <li><strong>Disburse:</strong> Only if the AI is cryptographically registered in our <strong>Agent Registry Contract</strong> will the payout be executed.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-3xl border border-ink-200 bg-ink-50 p-8 md:p-12">
        <h2 className="font-display text-2xl font-bold text-ink-900">
          Try the Simulation
        </h2>
        <p className="mt-4 text-ink-600">
          Our dashboard runs in a fully simulated environment so you can experience the flow without spending real XLM.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <span className="font-mono text-xs font-bold text-ink-400">STEP 1</span>
            <h3 className="mt-2 font-bold text-ink-900">Connect a Wallet</h3>
            <p className="mt-2 text-sm text-ink-500">Use a demo wallet to receive 100 fake XLM.</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <span className="font-mono text-xs font-bold text-ink-400">STEP 2</span>
            <h3 className="mt-2 font-bold text-ink-900">Make a Deposit</h3>
            <p className="mt-2 text-sm text-ink-500">Fund the Escrow contract via the Dashboard.</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <span className="font-mono text-xs font-bold text-ink-400">STEP 3</span>
            <h3 className="mt-2 font-bold text-ink-900">Ask the Agent</h3>
            <p className="mt-2 text-sm text-ink-500">Trigger the AI to evaluate a crisis scenario in the Intelligence tab.</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <span className="font-mono text-xs font-bold text-ink-400">STEP 4</span>
            <h3 className="mt-2 font-bold text-ink-900">Verify the Ledger</h3>
            <p className="mt-2 text-sm text-ink-500">Watch the automated payout happen in real-time on the blockchain.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
