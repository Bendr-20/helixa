import React, { useState } from 'react';
import { WalletButton } from './WalletButton';

export function TopBar({ onMobileMenuToggle, mobileMenuOpen }: { onMobileMenuToggle: () => void; mobileMenuOpen: boolean }) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {/* Mobile hamburger */}
        <button
          className={`hamburger md:hidden ${mobileMenuOpen ? 'active' : ''}`}
          onClick={onMobileMenuToggle}
          aria-label="Toggle menu"
          style={{ marginRight: 12 }}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Search */}
        <div className={`topbar-search ${searchFocused ? 'topbar-search-focused' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#666', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search agents, jobs..."
            className="topbar-search-input"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>

        {/* Right side */}
        <div className="topbar-right">
          {/* Notifications */}
          <button className="topbar-icon-btn" title="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>

          {/* Wallet / Sign In */}
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
