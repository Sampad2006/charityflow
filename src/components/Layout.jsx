import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import WalletConnect from './WalletConnect';
import FeedbackModal from './FeedbackModal';
import ErrorBoundary from './ErrorBoundary';
import { useApp } from '../context/AppContext';
import { CONFIG } from '../config';
import { shortAddress } from '../context/AppContext';

export default function Layout() {
  const { mode } = useApp();
  const location = useLocation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', path: '/' },
    { name: 'Ledger', path: '/ledger' },
    { name: 'Intelligence', path: '/intelligence' },
    { name: 'User Guide', path: '/guide' },
  ];

  return (
    <div className="min-h-screen bg-paper font-sans text-ink-900 selection:bg-coral/20">
      <div className="sr-only">
        <span>CharityFlow</span>
        <span>Aid Treasury</span>
        <span>Connect a Stellar wallet to interact with the treasury</span>
      </div>
      
      {/* Premium Navbar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-100 bg-paper/90 px-4 py-3 text-xs font-medium tracking-wide backdrop-blur md:px-8">
        
        {/* Left Side: Brand & Status */}
        <div className="flex flex-1 items-center gap-6">
          <Link to="/" className="font-display text-lg font-bold text-ink-900 transition-colors hover:text-ink-600">
            CharityFlow
          </Link>
          
          <div className="hidden items-center gap-1.5 text-ink-500 xl:flex">
            <span
              className={`block h-2 w-2 rounded-full ${
                mode === 'live' ? 'animate-pulse-subtle bg-emerald' : 'bg-amber'
              }`}
            />
            <span className="uppercase tracking-widest text-ink-600">
              {mode === 'live' ? 'Testnet Live' : 'Simulation Mode'}
            </span>
          </div>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden items-center justify-center gap-8 md:flex">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`relative py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                  isActive ? 'text-ink-900' : 'text-ink-400 hover:text-ink-900'
                }`}
              >
                {link.name}
                {isActive && (
                  <span className="absolute -bottom-3.5 left-1/2 h-[2px] w-full -translate-x-1/2 bg-ink-900" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Wallet & Feedback */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-paper px-3 py-1.5 text-[11px] font-semibold text-ink-600 transition-colors hover:border-ink-900 hover:text-ink-900 sm:flex"
            title="Give feedback on the testnet dApp"
          >
            <span>💬</span>
            <span>Feedback</span>
          </button>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content Area with Error Boundary */}
      <main className="mx-auto max-w-[1200px] px-4 pt-12 pb-24 md:px-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* In-App Feedback Modal */}
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-ink-100 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-400">
          CharityFlow · Decentralized Aid
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] uppercase tracking-widest text-ink-300">
          <span>Stellar Soroban</span>
          <span>·</span>
          <span>{mode === 'live' ? 'Live Testnet' : 'Simulation Mode'}</span>
          <span>·</span>
          <span>Escrow: {shortAddress(CONFIG.escrowContractId || 'Simulated')}</span>
          <span>·</span>
          <span>Registry: {shortAddress(CONFIG.registryContractId || 'Simulated')}</span>
          <span>·</span>
          <Link to="/privacy" className="text-ink-400 underline transition-colors hover:text-ink-900">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
