import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './providers/WalletProvider';
import { Layout } from './components/Layout';

// Pages
import { Home } from './pages/Home';
import { Mint } from './pages/Mint';
import { Directory } from './pages/Directory';
import { AgentProfile } from './pages/AgentProfile';
import { Leaderboard } from './pages/Leaderboard';
import { Manage } from './pages/Manage';

function App() {
  return (
    <WalletProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mint" element={<Mint />} />
            <Route path="/agents" element={<Directory />} />
            <Route path="/agent/:id" element={<AgentProfile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/manage" element={<Manage />} />
            
            {/* 404 Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </Router>
    </WalletProvider>
  );
}

// Simple 404 component
function NotFound() {
  return (
    <div className="py-20">
      <div className="container">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">❓</span>
          </div>
          <h1 className="text-3xl font-heading font-bold mb-4">Page Not Found</h1>
          <p className="text-muted mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex gap-4 justify-center">
            <a href="/" className="btn btn-primary">
              Go Home
            </a>
            <a href="/agents" className="btn btn-secondary">
              Browse Agents
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;