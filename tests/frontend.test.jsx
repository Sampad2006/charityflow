import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext';
import Layout from '../src/components/Layout';
import HomePage from '../src/pages/HomePage';
import LedgerPage from '../src/pages/LedgerPage';
import IntelligencePage from '../src/pages/IntelligencePage';
import UserGuidePage from '../src/pages/UserGuidePage';
import ToastContainer from '../src/components/ToastContainer';

// Mock the Stellar SDK layer so no network / wallet extensions are needed.
// The simulation backend handles the actual ledger state.
vi.mock('../src/utils/stellar', () => ({
  connectWallet: vi.fn(async () => 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMN'),
  disconnectWallet: vi.fn(async () => {}),
  fetchBalances: vi.fn(async () => ({
    balances: [{ assetType: 'native', asset_code: 'XLM', balance: '100', asset_issuer: '' }],
    nativeBalance: 100,
  })),
  listWallets: vi.fn(async () => []),
  onWalletStateChange: vi.fn(() => () => {}),
  onWalletDisconnect: vi.fn(() => () => {}),
  normalizeWalletError: vi.fn((err) => err),
  signWithWallet: vi.fn(async () => ''),
  sendXlmPayment: vi.fn(async () => ({ hash: 'TX', success: true })),
  invokeContract: vi.fn(async () => ({ hash: 'TX', success: true, result: {} })),
  readContract: vi.fn(async () => 0),
  fetchContractEvents: vi.fn(async () => ({ events: [], latestLedger: 1 })),
  scValAddress: vi.fn((a) => a),
  scValAmount: vi.fn((a) => a),
  scValSymbol: vi.fn((s) => s),
  sleep: vi.fn(async () => {}),
}));

const renderApp = () =>
  render(
    <AppProvider>
      <MemoryRouter initialEntries={['/']}>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="intelligence" element={<IntelligencePage />} />
            <Route path="guide" element={<UserGuidePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProvider>
  );

const connectWallet = async (user) => {
  // The header and the dashboard banner both expose a "Connect Wallet" button.
  await user.click(screen.getAllByRole('button', { name: 'Connect Wallet' })[0]);
  await screen.findByText('100 XLM', { selector: 'span' });
};

describe('CharityFlow simulation dashboard', () => {
  it('renders the app shell with treasury and wallet prompt', () => {
    renderApp();
    expect(screen.getAllByText('CharityFlow')[0]).toBeInTheDocument();
    expect(screen.getByText('Aid Treasury')).toBeInTheDocument();
    expect(screen.getByText(/Connect a Stellar wallet to interact with the treasury/i)).toBeInTheDocument();
  });

  it('rejects a donation larger than the donor balance', async () => {
    const user = userEvent.setup();
    renderApp();
    await connectWallet(user);

    await user.type(screen.getByTestId('donation-amount'), '250');
    await user.click(screen.getByTestId('donate-button'));

    expect(await screen.findByText(/Insufficient balance/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('escrow-balance')).toHaveTextContent('0 XLM');
  });

  it('runs the full flow: connect → donate → AI proposes → agent disburses', async () => {
    const user = userEvent.setup();
    renderApp();
    await connectWallet(user);

    // Donate 25 XLM into the escrow via the contract deposit path.
    await user.type(screen.getByTestId('donation-amount'), '25');
    await user.click(screen.getByTestId('donate-button'));

    await waitFor(
      () => expect(screen.getByTestId('escrow-balance')).toHaveTextContent('25 XLM'),
      { timeout: 5000 }
    );

    // Navigate to Ledger
    await user.click(screen.getByRole('link', { name: /ledger/i }));

    const feed = await screen.findByRole('heading', { name: 'Live Event Feed' });
    expect(within(feed.closest('section')).getByText('deposit')).toBeInTheDocument();

    // Navigate to Intelligence
    await user.click(screen.getByRole('link', { name: /intelligence/i }));
    await user.click(screen.getByTestId('run-agent'));
    const approveBtn = await screen.findByTestId('approve-payout', {}, { timeout: 3000 });

    await user.click(approveBtn);
    
    // Navigate back to Dashboard to check escrow balance
    await user.click(screen.getByRole('link', { name: /dashboard/i }));

    await waitFor(
      () => expect(screen.getByTestId('escrow-balance')).toHaveTextContent('0 XLM'),
      { timeout: 5000 }
    );

    // Navigate back to Ledger to check payout
    await user.click(screen.getByRole('link', { name: /ledger/i }));
    const feedAfter = await screen.findByRole('heading', { name: 'Live Event Feed' });
    expect(within(feedAfter.closest('section')).getByText('payout')).toBeInTheDocument();
    
    // Check dashboard for stats (navigating home)
    await user.click(screen.getByRole('link', { name: /dashboard/i }));
    expect(
      await screen.findByText((_, node) =>
        Boolean(node) && node.textContent.replace(/\s+/g, ' ').trim() === '1 payout executed'
      )
    ).toBeInTheDocument();
  });

  it('validates Soroban contract ID format correctly', async () => {
    const { isValidContractId } = await import('../src/config');
    expect(isValidContractId('CD6QUPH6HREZFJF6JVPEMDDI5OLKUMXTPVYFSAC7BMX376ZTFHTNEVCO')).toBe(true);
    expect(isValidContractId('invalid_contract_id')).toBe(false);
  });
});

