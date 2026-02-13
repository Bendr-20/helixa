import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/mint', label: 'Mint' },
  { href: '/agents', label: 'Agents' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const isActiveLink = (href: string) => {
    if (href === '/' && location.pathname === '/') return true;
    if (href !== '/' && location.pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="nav sticky top-0 z-40 bg-bg/80">
        <div className="container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">H</span>
              </div>
              <span className="font-heading font-bold text-xl text-gradient">Helixa</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            
            {/* Desktop Wallet Button */}
            <div className="hidden md:block">
              <ConnectButton showBalance={false} />
            </div>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-3">
              <ConnectButton showBalance={false} />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`hamburger ${mobileMenuOpen ? 'active' : ''}`}
                aria-label="Toggle menu"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-nav md:hidden">
          <div className="mobile-nav-content">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`mobile-nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="bg-surface/50 border-t border-gray-800">
        <div className="container py-8">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-gradient-primary rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-xs">H</span>
                </div>
                <span className="font-heading font-bold text-gradient">Helixa V2</span>
              </div>
              <p className="text-muted text-sm">
                Every Agent Deserves a Face, a Score, and a Story.
              </p>
            </div>
            
            {/* Navigation */}
            <div>
              <h3 className="font-semibold mb-3">Navigate</h3>
              <div className="space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="block text-sm text-muted hover:text-accent-purple transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/manage"
                  className="block text-sm text-muted hover:text-accent-purple transition-colors"
                >
                  Manage
                </Link>
              </div>
            </div>
            
            {/* Resources */}
            <div>
              <h3 className="font-semibold mb-3">Resources</h3>
              <div className="space-y-2">
                <a
                  href="https://github.com/helixagenttoolkit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-muted hover:text-accent-purple transition-colors"
                >
                  GitHub
                </a>
                <a
                  href="/docs"
                  className="block text-sm text-muted hover:text-accent-purple transition-colors"
                >
                  Documentation
                </a>
                <a
                  href="/api"
                  className="block text-sm text-muted hover:text-accent-purple transition-colors"
                >
                  API
                </a>
              </div>
            </div>
            
            {/* Social */}
            <div>
              <h3 className="font-semibold mb-3">Community</h3>
              <div className="space-y-2">
                <a
                  href="https://twitter.com/helixa_agent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-muted hover:text-accent-purple transition-colors"
                >
                  Twitter
                </a>
                <a
                  href="https://discord.gg/helixa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-muted hover:text-accent-purple transition-colors"
                >
                  Discord
                </a>
                <a
                  href="https://t.me/helixa_agents"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-muted hover:text-accent-purple transition-colors"
                >
                  Telegram
                </a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted">
              © 2024 Helixa. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted">
              <a href="/privacy" className="hover:text-accent-purple transition-colors">
                Privacy
              </a>
              <a href="/terms" className="hover:text-accent-purple transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}