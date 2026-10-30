import { useState } from 'react';

import { CascadeTab } from './components/CascadeTab';
import { SpectrumTab } from './components/SpectrumTab';
import { SummaryStrip } from './components/SummaryStrip';
import { useReceiverStore } from './state/receiverStore';
import { useSpectrumStore } from './state/spectrumStore';

type TabId = 'cascade' | 'spectrum' | 'ip3' | 'learn';

const TABS: { id: TabId; label: string }[] = [
  { id: 'cascade', label: 'Receiver cascade' },
  { id: 'spectrum', label: 'Spectrum analyzer' },
  { id: 'ip3', label: 'IP3 & SFDR' },
  { id: 'learn', label: 'Learn' },
];

export default function App() {
  const store = useReceiverStore();
  // Lifted above the tabs so the two-tone setup survives tab switches.
  const spectrum = useSpectrumStore(store.state.config, store.state.result);
  const [tab, setTab] = useState<TabId>('cascade');

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>RF Receiver Lab</h1>
          <span className="subtitle">
            Interactive cascade / spectrum / IP3 analysis
          </span>
        </div>
        <div className="actions">
          <button onClick={() => store.reset()} title="Restore the illustrative default receiver">
            Reset to defaults
          </button>
        </div>
      </header>

      <SummaryStrip totals={store.state.result?.totals ?? null} loading={store.state.loading} />

      {store.state.error && (
        <div className="warn-item error" style={{ margin: 12 }}>
          <strong>ERROR: </strong>
          {store.state.error}
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'cascade' && <CascadeTab store={store} />}
        {tab === 'spectrum' && <SpectrumTab store={store} spectrum={spectrum} />}
        {tab === 'ip3' && (
          <div className="panel">IP3 / SFDR chart will be built in Phase 3.</div>
        )}
        {tab === 'learn' && (
          <div className="panel">Learning articles will be added in Phase 3.</div>
        )}
      </main>
    </div>
  );
}
