import { useState } from 'react';
import { useApp } from '../context/AppContext';
import TransactionStatus from './TransactionStatus';

export default function EscrowConsole() {
  const { wallet, donate, pushToast } = useApp();
  const [donation, setDonation] = useState({ amount: '', method: 'contract' });
  const [tx, setTx] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSliderChange = (e) => {
    setDonation((d) => ({ ...d, amount: e.target.value }));
  };

  const handlePreset = (val) => {
    setDonation((d) => ({ ...d, amount: val.toString() }));
  };

  const submitDonation = async () => {
    console.log('--- submitDonation called with amount:', donation.amount);
    if (!donation.amount || parseFloat(donation.amount) <= 0) {
      console.log('--- submitDonation aborted due to invalid amount');
      return;
    }
    setTx({ status: 'pending' });
    setBusy(true);
    try {
      const res = await donate({
        amount: donation.amount,
        method: donation.method,
        onStatus: (s) => setTx({ status: s }),
      });
      console.log('--- submitDonation success:', res);
      setTx((t) => ({ ...t, status: 'success', hash: res.hash }));
    } catch (err) {
      console.log('--- submitDonation error:', err.message);
      setTx((t) => ({ ...t, status: 'failed', error: err.message }));
      pushToast({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-ink-900">Choose an amount</h3>
          <p className="mt-2 text-sm text-ink-500">
            Your donation is held securely in the CharityEscrow smart contract.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[25, 50, 100, 250].map((val) => (
              <button
                key={val}
                onClick={() => handlePreset(val)}
                className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${
                  donation.amount === val.toString()
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-ink-900 hover:text-ink-900'
                }`}
              >
                {val} XLM
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-400">Custom amount</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={donation.amount}
                  onChange={(e) => setDonation((d) => ({ ...d, amount: e.target.value }))}
                  data-testid="donation-amount"
                  className="w-24 bg-transparent text-right font-mono text-lg font-bold text-ink-900 outline-none"
                  placeholder="0"
                />
                <span className="font-mono text-lg font-bold text-ink-900">XLM</span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="1000"
              step="1"
              value={donation.amount || 0}
              onChange={handleSliderChange}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-100 accent-ink-900"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-ink-900">Donation Method</span>
            <div className="flex rounded-lg border border-ink-200 p-0.5 bg-ink-50">
              {[
                { key: 'contract', label: 'Smart deposit' },
                { key: 'classic', label: 'Classic XLM' },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => setDonation((d) => ({ ...d, method: m.key }))}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    donation.method === m.key
                      ? 'bg-white text-ink-900 shadow-sm'
                      : 'text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-500">
            {donation.method === 'contract'
              ? 'Funds are locked in the CharityEscrow smart contract. They can only be disbursed by an authorized AI agent.'
              : 'Sends a standard XLM payment directly to the treasury wallet. Our treasurer will manually forward it to the escrow.'}
          </p>
        </div>
      </div>

      <div className="lg:pl-8">
        <div className="sticky top-24 rounded-3xl bg-ink-900 p-8 text-white shadow-2xl">
          <h4 className="font-mono text-xs font-medium uppercase tracking-widest text-ink-400">
            Donation Summary
          </h4>
          
          <div className="mt-8 space-y-4 font-mono text-sm">
            <div className="flex justify-between border-b border-ink-800 pb-4">
              <span className="text-ink-400">Amount</span>
              <span className="text-paper">{donation.amount || '0'} XLM</span>
            </div>
            <div className="flex justify-between border-b border-ink-800 pb-4">
              <span className="text-ink-400">Method</span>
              <span className="text-paper">{donation.method === 'contract' ? 'Smart Contract' : 'Classic'}</span>
            </div>
            <div className="flex justify-between border-b border-ink-800 pb-4">
              <span className="text-ink-400">Network Fee</span>
              <span className="text-paper">~0.0001 XLM</span>
            </div>
            <div className="flex justify-between pt-2 text-lg font-bold">
              <span className="text-white">Total</span>
              <span className="text-white">{donation.amount || '0'} XLM</span>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {!wallet.publicKey && (
              <div className="rounded-xl border border-amber/30 bg-amber/10 p-3 text-center text-xs font-medium text-amber">
                Please connect your wallet first.
              </div>
            )}
            
            <button
              onClick={submitDonation}
              disabled={busy || !wallet.publicKey || !donation.amount || parseFloat(donation.amount) <= 0}
              data-testid="donate-button"
              className="w-full rounded-xl bg-white py-4 text-center text-sm font-bold text-ink-900 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:opacity-50 disabled:hover:scale-100"
            >
              {busy ? 'Processing...' : 'Confirm Donation'}
            </button>
            
            <p className="text-center text-[11px] text-ink-500">
              You will be prompted to sign this transaction in your wallet.
            </p>
          </div>

          {tx && <div className="mt-6"><TransactionStatus status={tx.status} hash={tx.hash} /></div>}
        </div>
      </div>
    </div>
  );
}
