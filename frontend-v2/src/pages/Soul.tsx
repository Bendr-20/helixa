import { useState } from 'react';
import { SoulKeeper } from './SoulKeeper';
import { SoulHandshake } from './SoulHandshake';

type SoulTab = 'keeper' | 'handshake';

export function Soul() {
  const [activeTab, setActiveTab] = useState<SoulTab>('keeper');

  return (
    <>
      {/* Sub-tab selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        paddingTop: '1.5rem',
      }}>
        <button
          onClick={() => setActiveTab('keeper')}
          className={`btn ${activeTab === 'keeper' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ minWidth: 150 }}
        >
          🔒 Soul Keeper
        </button>
        <button
          onClick={() => setActiveTab('handshake')}
          className={`btn ${activeTab === 'handshake' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ minWidth: 150 }}
        >
          🤝 Handshake
        </button>
      </div>

      {/* Content — each sub-page has its own container/padding */}
      {activeTab === 'keeper' ? <SoulKeeper /> : <SoulHandshake />}
    </>
  );
}
