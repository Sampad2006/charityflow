import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LedgerPage from './pages/LedgerPage';
import IntelligencePage from './pages/IntelligencePage';
import UserGuidePage from './pages/UserGuidePage';
import PrivacyPage from './pages/PrivacyPage';
import ToastContainer from './components/ToastContainer';

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="intelligence" element={<IntelligencePage />} />
          <Route path="guide" element={<UserGuidePage />} />
          <Route path="privacy" element={<PrivacyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
