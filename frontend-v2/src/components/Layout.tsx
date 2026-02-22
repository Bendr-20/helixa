import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletButton } from './WalletButton';
import { DnaBackground } from './DnaBackground';
import { preloadMap } from '../App';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/mint', label: 'Mint' },
  { href: '/agents', label: 'Agents' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/manage', label: 'Manage' },
  { href: '/token.html', label: '$CRED' },
  { href: '/messages.html', label: 'Messages' },
  { href: '/docs', label: 'Docs' },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      setNavVisible(y < 20 || y < lastScrollY.current);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  
  const isActiveLink = (href: string) => {
    if (href === '/' && location.pathname === '/') return true;
    if (href !== '/' && location.pathname.startsWith(href)) return true;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Holographic Swirl Background */}
      {/* DNA Double Helix Background — Canvas 3D */}
      <DnaBackground />
      {/* Nav spacer for fixed positioning */}
      <div style={{ height: 64 }} />
      {/* Navigation */}
      <nav className={`nav ${scrolled ? 'nav-scrolled' : ''} ${navVisible ? '' : 'nav-hidden'}`}>
        <div className="container" style={{ width: '100%' }}>
          <div className="flex items-center justify-between" style={{ height: '100%' }}>
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 nav-logo-text" style={{ textDecoration: 'none' }}>
              <span className="text-gradient" style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '1.4rem',
                fontWeight: 700,
                letterSpacing: '-0.5px',
              }}>
                helixa<span style={{ color: 'var(--text2)', fontWeight: 400, WebkitTextFillColor: 'var(--text2)' }}>.xyz</span>
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                link.href.includes('.html') ? (
                <a
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
                >
                  {link.label}
                </a>
                ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
                  onMouseEnter={() => preloadMap[link.href]?.()}
                >
                  {link.label}
                </Link>
                )
              ))}
            </div>
            
            {/* Desktop Wallet Button */}
            <div className="hidden md:block">
              <WalletButton />
            </div>
            
            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center gap-3">
              <WalletButton />
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
              link.href.includes('.html') ? (
              <a
                key={link.href}
                href={link.href}
                className={`mobile-nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
              >
                {link.label}
              </a>
              ) : (
              <Link
                key={link.href}
                to={link.href}
                className={`mobile-nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
              )
            ))}
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Footer — Clean & Minimal */}
      <footer>
        <div className="container" style={{ padding: '1.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#555', fontSize: '0.75rem' }}>Helixa Protocol</span>
          <span style={{ color: '#333', fontSize: '0.6rem' }}>·</span>
          <a href="https://github.com/Bendr-20/helixa" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span style={{ color: '#333', fontSize: '0.6rem' }}>·</span>
          <a href="https://x.com/HelixaXYZ" target="_blank" rel="noopener noreferrer">Twitter</a>
          <span style={{ color: '#333', fontSize: '0.6rem' }}>·</span>
          <Link to="/docs">Docs</Link>
        </div>
      </footer>
    </div>
  );
}
