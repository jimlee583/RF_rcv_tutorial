import { useState } from 'react';

import { CascadeTab } from './components/CascadeTab';
import { Ip3Tab } from './components/Ip3Tab';
import { JammerTab } from './components/JammerTab';
import { LearnTab } from './components/LearnTab';
import { SpectrumTab } from './components/SpectrumTab';
import { SummaryStrip } from './components/SummaryStrip';
import { TestTab, useTestStore } from './components/TestTab';
import { useIp3Store } from './state/ip3Store';
import { useJammerStore } from './state/jammerStore';
import { useReceiverStore } from './state/receiverStore';
import { useSpectrumStore } from './state/spectrumStore';
import type { LearnTopicId } from './testQuestions';

type TabId = 'cascade' | 'spectrum' | 'ip3' | 'jammer' | 'learn' | 'test';

const TABS: { id: TabId; label: string }[] = [
  { id: 'cascade', label: 'Receiver cascade' },
  { id: 'spectrum', label: 'Spectrum analyzer' },
  { id: 'ip3', label: 'IP3 & SFDR' },
  { id: 'jammer', label: 'Jammers' },
  { id: 'learn', label: 'Learn' },
  { id: 'test', label: 'Test' },
];

export default function App() {
  const store = useReceiverStore();
  // Lifted above the tabs so the two-tone / IP3 setup survives tab switches.
  const spectrum = useSpectrumStore(store.state.config, store.state.result);
  const ip3 = useIp3Store(store.state.config, store.state.result);
  const jammer = useJammerStore(store.state.config, store.state.result);
  const test = useTestStore();
  const [tab, setTab] = useState<TabId>('cascade');
  // Set by the Test tab when the user clicks "Review in Learn" so the Learn
  // tab opens on the right article.
  const [requestedLearnTopic, setRequestedLearnTopic] =
    useState<LearnTopicId | null>(null);

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
        {tab === 'ip3' && <Ip3Tab store={store} ip3={ip3} />}
        {tab === 'jammer' && <JammerTab store={store} jammer={jammer} />}
        {tab === 'learn' && (
          <LearnTab
            requestedTopicId={requestedLearnTopic}
            onConsumeRequestedTopic={() => setRequestedLearnTopic(null)}
          />
        )}
        {tab === 'test' && (
          <TestTab
            store={test}
            onReviewInLearn={(topicId) => {
              setRequestedLearnTopic(topicId);
              setTab('learn');
            }}
          />
        )}
      </main>
    </div>
  );
}
