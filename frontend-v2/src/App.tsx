import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { WalletProvider } from './providers/WalletProvider';
import { Layout } from './components/Layout';
import { lazy, Suspense, useEffect, useState } from 'react';

// Lazy-loaded pages with preload support
const pageImports = {
  home: () => import('./pages/Home').then(m => ({ default: m.Home })),
  mint: () => import('./pages/Mint').then(m => ({ default: m.Mint })),
  directory: () => import('./pages/Directory').then(m => ({ default: m.Directory })),
  agentProfile: () => import('./pages/AgentProfile').then(m => ({ default: m.AgentProfile })),
  leaderboard: () => import('./pages/Leaderboard').then(m => ({ default: m.Leaderboard })),
  manage: () => import('./pages/Manage').then(m => ({ default: m.Manage })),
  docs: () => import('./pages/Docs').then(m => ({ default: m.Docs })),
  report: () => import('./pages/Report').then(m => ({ default: m.Report })),
  token: () => import('./pages/Token').then(m => ({ default: m.Token })),
  messages: () => import('./pages/Messages').then(m => ({ default: m.Messages })),
  credReport: () => import('./pages/CredReport').then(m => ({ default: m.CredReport })),
  stake: () => import('./pages/Stake').then(m => ({ default: m.Stake })),
};

const Home = lazy(pageImports.home);
const Mint = lazy(pageImports.mint);
const Directory = lazy(pageImports.directory);
const AgentProfile = lazy(pageImports.agentProfile);
const Leaderboard = lazy(pageImports.leaderboard);
const Manage = lazy(pageImports.manage);
const Docs = lazy(pageImports.docs);
const Report = lazy(pageImports.report);
const Token = lazy(pageImports.token);
const MessagesPage = lazy(pageImports.messages);
const CredReport = lazy(pageImports.credReport);
const StakePage = lazy(pageImports.stake);

// Preload all pages after initial render
function usePreloadPages() {
  useEffect(() => {
    const timer = setTimeout(() => {
      Object.values(pageImports).forEach(fn => fn());
    }, 1500); // preload after 1.5s
    return () => clearTimeout(timer);
  }, []);
}

// Map nav paths to preload functions for hover preloading
export const preloadMap: Record<string, () => void> = {
  '/': pageImports.home,
  '/mint': pageImports.mint,
  '/agents': pageImports.directory,
  // '/leaderboard': pageImports.leaderboard,
  '/docs': pageImports.docs,
  '/manage': pageImports.manage,
  '/token': pageImports.token,
  '/messages': pageImports.messages,
  '/cred-report': pageImports.credReport,
  '/stake': pageImports.stake,
};

function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setVisible(false);
    // Use rAF to ensure the opacity:0 frame paints first, then fade in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, [location.pathname]);

  return (
    <div
      className="page-transition"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

// Spinner that only shows after a delay (prevents flash for fast loads)
function PageSpinner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, []);
  if (!show) return <div style={{ minHeight: '60vh' }} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  usePreloadPages();

  return (
    <PageTransition>
      <Suspense fallback={<PageSpinner />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/mint" element={<Mint />} />
          <Route path="/agents" element={<Directory />} />
          <Route path="/agent/:id" element={<AgentProfile />} />
          {/* <Route path="/leaderboard" element={<Leaderboard />} /> */}
          <Route path="/manage" element={<Manage />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/token" element={<Token />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/cred-report" element={<CredReport />} />
          <Route path="/stake" element={<StakePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </PageTransition>
  );
}

function App() {
  return (
    <WalletProvider>
      <Router>
        <Layout>
          <AnimatedRoutes />
        </Layout>
      </Router>
    </WalletProvider>
  );
}

function NotFound() {
  return (
    <div className="py-20">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h1 className="text-3xl font-heading font-bold mb-4">Page Not Found</h1>
          <p className="text-muted mb-8">The page you're looking for doesn't exist or has been moved.</p>
          <div className="flex gap-4 justify-center">
            <a href="/" className="btn btn-primary">Go Home</a>
            <a href="/agents" className="btn btn-secondary">Browse Agents</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
