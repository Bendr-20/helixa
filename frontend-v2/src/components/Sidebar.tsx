import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { preloadMap } from '../App';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '' },
  { href: '/agents', label: 'Directory', icon: '' },
  { href: '/jobs', label: 'Jobs', icon: '' },
  { href: '/trust-graph', label: 'Trust Graph', icon: '' },
  { href: '/manage', label: 'Manage', icon: '' },
];

const secondaryItems = [
  { href: '/mint', label: 'Register', icon: '' },
  { href: '/token', label: '$CRED', icon: '' },
  { href: '/docs', label: 'Docs', icon: '' },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/' && location.pathname === '/') return true;
    if (href !== '/' && location.pathname.startsWith(href)) return true;
    return false;
  };

  const renderItem = (item: typeof navItems[0]) => {
    const active = isActive(item.href);
    const content = (
      <div
        className={`sidebar-item ${active ? 'sidebar-item-active' : ''}`}
        title={collapsed ? item.label : undefined}
      >
        <span className="sidebar-icon">{item.icon}</span>
        {!collapsed && <span className="sidebar-label">{item.label}</span>}
      </div>
    );

    if ((item as any).external) {
      return (
        <a key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
          {content}
        </a>
      );
    }

    return (
      <Link
        key={item.href}
        to={item.href}
        style={{ textDecoration: 'none', color: 'inherit' }}
        onMouseEnter={() => preloadMap[item.href]?.()}
      >
        {content}
      </Link>
    );
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-header">
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-gradient" style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: collapsed ? '1rem' : '1.3rem',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            whiteSpace: 'nowrap',
          }}>
            {collapsed ? 'H' : <>helixa<span style={{ color: 'var(--text2)', fontWeight: 400, WebkitTextFillColor: 'var(--text2)' }}>.xyz</span></>}
          </span>
        </Link>
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Main nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          {navItems.map(renderItem)}
        </div>
        <div className="sidebar-divider" />
        <div className="sidebar-section">
          {!collapsed && <div className="sidebar-section-label">More</div>}
          {secondaryItems.map(renderItem)}
        </div>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {!collapsed && (
          <div style={{ fontSize: '0.7rem', color: '#555', textAlign: 'center', padding: '0 8px' }}>
            <a href="https://github.com/Bendr-20/helixa" target="_blank" rel="noopener noreferrer" style={{ color: '#666' }}>GitHub</a>
            {' · '}
            <a href="https://x.com/HelixaXYZ" target="_blank" rel="noopener noreferrer" style={{ color: '#666' }}>Twitter</a>
          </div>
        )}
      </div>
    </aside>
  );
}
