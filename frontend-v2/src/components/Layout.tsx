import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletButton } from './WalletButton';
import { DnaBackground } from './DnaBackground';
import { preloadMap } from '../App';

const primaryLinks = [
  { href: '/', label: 'Home' },
  { href: '/mint', label: 'Mint' },
  { href: '/terminal', label: 'Terminal', external: true },
  { href: '/agents', label: 'Agents' },
  { href: '/token', label: '$CRED' },
];

const moreLinks = [
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/manage', label: 'Manage' },
  { href: '/messages', label: 'Messages' },
  { href: '/docs', label: 'Docs' },
];

const navLinks = [...primaryLinks, ...moreLinks];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const moreRef = useRef<HTMLDivElement>(null);
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

  // Close "More" dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Close "More" on route change
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);
  
  const isActiveLink = (href: string) => {
    if (href === '/' && location.pathname === '/') return true;
    if (href !== '/' && location.pathname.startsWith(href)) return true;
    return false;
  };

  const renderNavLink = (link: { href: string; label: string; external?: boolean }, onClick?: () => void) => {
    if ((link as any).external) {
      return (
        <a key={link.href} href={link.href} className="nav-link" onClick={onClick}>
          {link.label}
        </a>
      );
    }
    return (
      <Link
        key={link.href}
        to={link.href}
        className={`nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
        onMouseEnter={() => preloadMap[link.href]?.()}
        onClick={onClick}
      >
        {link.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <DnaBackground />
      <div style={{ height: 64 }} />
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
            <div className="hidden md:flex items-center gap-3">
              {primaryLinks.map((link) => renderNavLink(link))}
              
              {/* More dropdown */}
              <div ref={moreRef} style={{ position: 'relative' }}>
                <button
                  className="nav-link"
                  onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  More <span style={{ fontSize: '0.7em', opacity: 0.7 }}>{moreOpen ? '▲' : '▼'}</span>
                </button>
                {moreOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.5rem',
                    background: 'rgba(10, 10, 20, 0.95)',
                    border: '1px solid rgba(110, 236, 216, 0.2)',
                    borderRadius: '8px',
                    padding: '0.5rem 0',
                    minWidth: '150px',
                    zIndex: 100,
                    backdropFilter: 'blur(10px)',
                  }}>
                    {moreLinks.map((link) => (
                      (link as any).external ? (
                        <a
                          key={link.href}
                          href={link.href}
                          className="nav-link"
                          style={{ display: 'block', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                          onClick={() => setMoreOpen(false)}
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          key={link.href}
                          to={link.href}
                          className={`nav-link ${isActiveLink(link.href) ? 'active' : ''}`}
                          style={{ display: 'block', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
                          onMouseEnter={() => preloadMap[link.href]?.()}
                          onClick={() => setMoreOpen(false)}
                        >
                          {link.label}
                        </Link>
                      )
                    ))}
                  </div>
                )}
              </div>
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
      
      {/* Mobile Menu — all links flat */}
      {mobileMenuOpen && (
        <div className="mobile-nav md:hidden">
          <div className="mobile-nav-content">
            {navLinks.map((link) => (
              (link as any).external ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
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
      <main className="flex-1" style={{ position: 'relative', zIndex: 1, minHeight: 0 }}>
        {children}
      </main>
      
      {/* Footer */}
      <footer>
        <div className="container" style={{ padding: '1.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#555', fontSize: '0.75rem' }}>Helixa Protocol</span>
          <span style={{ color: '#333', fontSize: '0.6rem' }}>·</span>
          <a href="https://github.com/Bendr-20/helixa" target="_blank" rel="noopener noreferrer">GitHub</a>
          <span style={{ color: '#333', fontSize: '0.6rem' }}>·</span>
          <a href="https://x.com/HelixaXYZ" target="_blank" rel="noopener noreferrer">Twitter</a>
          <span style={{ color: '#333', fontSize: '0.6rem' }}>·</span>
          <Link to="/docs">Docs</Link>
          <span style={{ color: '#333', fontSize: '0.6rem' }}>·</span>
          <a href="https://opensea.io/assets/base/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60" target="_blank" rel="noopener noreferrer">OpenSea</a>
        </div>
      </footer>
    </div>
  );
}
