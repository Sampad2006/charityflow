const EVENT_POLL_INTERVAL_MS = 4000;
import { trackEvent } from '../utils/analytics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as stellar from '../utils/stellar';
import { simulation } from '../utils/simulation';
import { escrowClient } from '../contracts/escrowClient';
import { registryClient } from '../contracts/registryClient';
import { CONFIG, isLive } from '../config';

const AppContext = createContext(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}

export function shortAddress(address, len = 6) {
  if (!address) return '';
  return address.length <= len * 2 + 3 ? address : `${address.slice(0, len)}…${address.slice(-4)}`;
}

const MINIMUM_XLM = 1.5;

export function AppProvider({ children }) {
  const [wallet, setWallet] = useState({
    publicKey: null,
    nativeBalance: 0,
    balances: [],
    connecting: false,
  });
  const [escrowBalance, setEscrowBalance] = useState(0);
  const [stats, setStats] = useState(() => escrowClient.stats());
  const [events, setEvents] = useState(() => escrowClient.history());
  const [toasts, setToasts] = useState([]);

  const mode = useMemo(() => (isLive() ? 'live' : 'simulation'), []);
  const toastId = useRef(0);

  // ─────────────────────────────── toasts ───────────────────────────────

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    ({ type = 'info', message, txHash }) => {
      const id = ++toastId.current;
      setToasts((prev) => [...prev, { id, type, message, txHash }]);
      window.setTimeout(() => dismissToast(id), 8000);
    },
    [dismissToast]
  );

  // ─────────────────────────────── escrow ───────────────────────────────

  const refreshEscrow = useCallback(async (sourcePk = wallet.publicKey) => {
    try {
      const balance = await escrowClient.escrowBalance({ source: sourcePk });
      setEscrowBalance(balance);
    } catch (err) {
      console.error('refreshEscrow failed:', err);
      // live mode requires a connected wallet — keep last known balance
    }
    setStats(escrowClient.stats());
  }, [wallet.publicKey]);

  // ─────────────────────────────── wallet ───────────────────────────────

  const refreshWallet = useCallback(
    async (publicKey) => {
      if (!publicKey) return;
      try {
        const { balances, nativeBalance } = await stellar.fetchBalances(publicKey);
        if (mode === 'simulation') simulation.mirrorIfUnknown(publicKey, nativeBalance);
        setWallet((prev) => ({ ...prev, publicKey, balances, nativeBalance }));
        return nativeBalance;
      } catch (err) {
        throw new Error(`Could not fetch balances: ${err.message}`);
      }
    },
    [mode]
  );

  const connect = useCallback(async (walletId) => {
    setWallet((prev) => ({ ...prev, connecting: true }));
    try {
      const publicKey = await stellar.connectWallet(walletId);
      await refreshWallet(publicKey);
      setWallet((prev) => ({ ...prev, publicKey, connecting: false }));
      await refreshEscrow(publicKey);
      pushToast({ type: 'success', message: `Connected ${shortAddress(publicKey, 5)}` });
      trackEvent('wallet_connected', { address: publicKey });
      return publicKey;
    } catch (err) {
      setWallet((prev) => ({ ...prev, connecting: false }));
      throw err;
    }
  }, [refreshWallet, refreshEscrow, pushToast]);

  const disconnect = useCallback(async () => {
    await stellar.disconnectWallet();
    setWallet({ publicKey: null, nativeBalance: 0, balances: [], connecting: false });
    trackEvent('wallet_disconnected');
    pushToast({ type: 'info', message: 'Wallet disconnected.' });
  }, [pushToast]);

  // ─────────────────────────────── actions ───────────────────────────────

  /**
   * Donation flow.
   * @param {{ amount: number, method: 'contract'|'classic', onStatus: (s)=>void }} opts
   */
  const donate = useCallback(
    async ({ amount, method = 'contract', onStatus }) => {
      const pk = wallet.publicKey;
      if (!pk) throw new Error('Connect a wallet to donate.');
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a valid amount greater than 0.');
      const donorBalance = mode === 'simulation' ? simulation.balanceOf(pk) : wallet.nativeBalance;
      if (value > donorBalance - 0.00001) {
        throw new Error(
          `Insufficient balance: you need ${value.toFixed(2)} XLM but only have ${donorBalance.toFixed(2)} XLM.`
        );
      }

      let res;
      if (method === 'classic') {
        const to = CONFIG.escrowWallet || (mode === 'simulation' ? 'escrow' : '');
        if (!to) {
          throw new Error('No escrow wallet configured for classic donations (set VITE_ESCROW_WALLET).');
        }
        res = await escrowClient.sendDonation({ from: pk, to, amount: value, onStatus });
      } else {
        res = await escrowClient.deposit({ donor: pk, amount: value, source: pk, onStatus });
      }

      await refreshWallet(pk);
      await refreshEscrow(pk);
      return res;
    },
    [wallet, mode, refreshWallet, refreshEscrow]
  );

  /**
   * AI-agent disbursal.
   */
  const disburse = useCallback(
    async ({ to, amount, reason, onStatus }) => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a valid payout amount.');
      if (value > escrowBalance) {
        throw new Error(`Insufficient escrow balance: request ${value} XLM but escrow holds ${escrowBalance} XLM.`);
      }
      const res = await escrowClient.requestPayout({
        agent: CONFIG.agentPublicKey,
        to,
        amount: value,
        reason,
        onStatus,
      });
      await refreshEscrow();
      return res;
    },
    [escrowBalance, refreshEscrow]
  );

  const addAgent = useCallback(
    async ({ agent, onStatus }) => {
      const admin = wallet.publicKey;
      const res = await registryClient.addAgent({ admin, agent, onStatus });
      pushToast({ type: 'success', message: `Agent ${shortAddress(agent, 5)} registered.` });
      return res;
    },
    [wallet.publicKey, pushToast]
  );

  const removeAgent = useCallback(
    async ({ agent, onStatus }) => {
      const admin = wallet.publicKey;
      const res = await registryClient.removeAgent({ admin, agent, onStatus });
      pushToast({ type: 'success', message: `Agent ${shortAddress(agent, 5)} removed.` });
      return res;
    },
    [wallet.publicKey, pushToast]
  );

  // ─────────────────────────────── events ───────────────────────────────

  useEffect(() => {
    // Fetch initial balance unconditionally (simulation mode supports this without auth)
    escrowClient.escrowBalance().then(setEscrowBalance).catch(() => {});
    
    return escrowClient.watchEvents((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 200));
    });
  }, []);

  // ─────────────────────────────── value ───────────────────────────────

  const balance =
    mode === 'simulation' && wallet.publicKey ? simulation.balanceOf(wallet.publicKey) : wallet.nativeBalance;

  const value = useMemo(
    () => ({
      mode,
      wallet,
      balance,
      escrowBalance,
      stats,
      events,
      toasts,
      agents: registryClient.listAgents(),
      connect,
      disconnect,
      donate,
      disburse,
      addAgent,
      removeAgent,
      refreshEscrow,
      refreshWallet,
      pushToast,
      dismissToast,
    }),
    [
      mode,
      wallet,
      balance,
      escrowBalance,
      stats,
      events,
      toasts,
      connect,
      disconnect,
      donate,
      disburse,
      addAgent,
      removeAgent,
      refreshEscrow,
      refreshWallet,
      pushToast,
      dismissToast,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export { MINIMUM_XLM };
