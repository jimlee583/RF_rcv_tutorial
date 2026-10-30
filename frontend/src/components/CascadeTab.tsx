import type { ReceiverStore } from '../state/receiverStore';
import { BlockDiagram } from './BlockDiagram';
import { ComponentTable } from './ComponentTable';
import { StageTable } from './StageTable';
import { WarningList } from './WarningList';
import { Tooltip } from './Tooltip';

export function CascadeTab({ store }: { store: ReceiverStore }) {
  const { state } = store;
  if (!state.config) return <div>Loading defaults...</div>;
  const cfg = state.config;
  return (
    <div>
      {cfg.illustrative && (
        <div className="callout illustrative">
          Numbers below are representative, not from any specific real part. See
          the Learn tab for engineering notes.
        </div>
      )}

      <div className="panel">
        <h2>Receiver block diagram</h2>
        <BlockDiagram components={cfg.components} result={state.result} />
      </div>

      <div className="panel">
        <h2>Operating conditions</h2>
        <div className="form-row">
          <div>
            <label><Tooltip label="Source frequency">Center frequency of the desired signal at the receiver input.  Used for frequency tracking and band warnings.</Tooltip></label>
            <input
              type="number"
              step="any"
              value={cfg.source_frequency_hz !== null ? cfg.source_frequency_hz / 1e6 : ''}
              onChange={(e) => {
                const text = e.target.value;
                const v = text === '' ? null : Number(text);
                store.setMeta(
                  { source_frequency_hz: v !== null && Number.isFinite(v) ? v * 1e6 : null },
                  `Changed source frequency to ${text || 'none'} MHz`,
                );
              }}
            />
            <div style={{ color: 'var(--fg-dim)', fontSize: '0.8em' }}>MHz</div>
          </div>
          <div>
            <label><Tooltip label="Bandwidth">Receiver noise bandwidth B. Noise floor = kTB + NF.</Tooltip></label>
            <input
              type="number"
              step="any"
              value={cfg.bandwidth_hz / 1e3}
              min={0.001}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v) || v <= 0) return;
                store.setMeta(
                  { bandwidth_hz: v * 1e3 },
                  `Changed bandwidth to ${v} kHz`,
                );
              }}
            />
            <div style={{ color: 'var(--fg-dim)', fontSize: '0.8em' }}>kHz</div>
          </div>
          <div>
            <label><Tooltip label="Temperature">Reference temperature for thermal noise.  Standard T0 = 290 K.</Tooltip></label>
            <input
              type="number"
              step="any"
              min={1}
              value={cfg.temperature_k}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v) || v <= 0) return;
                store.setMeta(
                  { temperature_k: v },
                  `Changed temperature to ${v} K`,
                );
              }}
            />
            <div style={{ color: 'var(--fg-dim)', fontSize: '0.8em' }}>K</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Components</h2>
        <ComponentTable store={store} result={state.result} />
      </div>

      <div className="panel">
        <h2>Per-stage cascade</h2>
        <StageTable result={state.result} />
        <WarningList warnings={state.result?.warnings ?? []} />
      </div>
    </div>
  );
}
