// Editable component table.  Each row shows the fields relevant to its
// component type.  Numeric inputs preserve `null` for cleared values.

import { useCallback } from 'react';

import type { ReceiverStore } from '../state/receiverStore';
import type {
  AmplifierComponent,
  AttenuatorComponent,
  CascadeResponse,
  FilterComponent,
  LnaComponent,
  MixerComponent,
  RfComponent,
} from '../types';
import { Tooltip } from './Tooltip';

function NumberInput({
  value,
  onChange,
  step,
  min,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
}) {
  return (
    <input
      type="number"
      value={value === null ? '' : value}
      step={step ?? 'any'}
      min={min}
      onChange={(e) => {
        const text = e.target.value;
        if (text === '') onChange(null);
        else {
          const n = Number(text);
          onChange(Number.isFinite(n) ? n : null);
        }
      }}
    />
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

function HzInput({
  value,
  onChange,
  unit = 'MHz',
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: 'Hz' | 'kHz' | 'MHz' | 'GHz';
}) {
  const scale =
    unit === 'GHz' ? 1e9 : unit === 'MHz' ? 1e6 : unit === 'kHz' ? 1e3 : 1;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <input
        type="number"
        step="any"
        value={value === null ? '' : value / scale}
        onChange={(e) => {
          const text = e.target.value;
          if (text === '') onChange(null);
          else {
            const n = Number(text);
            onChange(Number.isFinite(n) ? n * scale : null);
          }
        }}
      />
      <span style={{ color: 'var(--fg-dim)', fontSize: '0.8em' }}>{unit}</span>
    </div>
  );
}

export function ComponentTable({
  store,
  result,
}: {
  store: ReceiverStore;
  result: CascadeResponse | null;
}) {
  const { state } = store;
  if (!state.config || !state.templates) return <div>Loading...</div>;

  const addComponent = useCallback(
    (type: string) => {
      const template = state.templates?.[type];
      if (!template) return;
      const id = `${type}_${Date.now().toString(36)}`;
      store.addComponent({ ...template, id, name: template.name });
    },
    [store, state.templates],
  );

  const limitingId = result?.totals.input_p1db_limiting_stage_id ?? null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--fg-dim)', alignSelf: 'center' }}>Add:</span>
        {Object.keys(state.templates).map((t) => (
          <button key={t} onClick={() => addComponent(t)}>
            + {t}
          </button>
        ))}
      </div>
      <table className="components">
        <thead>
          <tr>
            <th style={{ width: 24 }}>#</th>
            <th>Name / Type</th>
            <th>Parameters</th>
            <th style={{ width: 90 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {state.config.components.map((c, idx) => (
            <tr key={c.id}>
              <td>{idx + 1}</td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextInput
                    value={c.name}
                    onChange={(v) => store.updateComponent(c.id, { name: v })}
                  />
                  <span style={{ color: 'var(--fg-dim)', fontSize: '0.8em' }}>
                    {c.type}
                    {limitingId === c.id && (
                      <span className="chip limiting" style={{ marginLeft: 6 }}>
                        P1dB limiting
                      </span>
                    )}
                  </span>
                </div>
              </td>
              <td>
                <ComponentFields
                  comp={c}
                  onChange={(patch) => store.updateComponent(c.id, patch)}
                />
              </td>
              <td>
                <div className="row-actions">
                  <button
                    onClick={() => store.moveComponent(c.id, 'up')}
                    disabled={idx === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => store.moveComponent(c.id, 'down')}
                    disabled={idx === state.config!.components.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => store.removeComponent(c.id)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComponentFields({
  comp,
  onChange,
}: {
  comp: RfComponent;
  onChange: (patch: Partial<RfComponent>) => void;
}) {
  switch (comp.type) {
    case 'amplifier':
    case 'lna':
      return <AmpFields comp={comp} onChange={onChange} />;
    case 'filter':
      return <FilterFields comp={comp} onChange={onChange} />;
    case 'attenuator':
      return <AttenFields comp={comp} onChange={onChange} />;
    case 'mixer':
      return <MixerFields comp={comp} onChange={onChange} />;
    default:
      return null;
  }
}

function AmpFields({
  comp,
  onChange,
}: {
  comp: AmplifierComponent | LnaComponent;
  onChange: (patch: Partial<AmplifierComponent | LnaComponent>) => void;
}) {
  return (
    <div className="form-row">
      <div>
        <label><Tooltip label="Gain (dB)">Small-signal power gain of the amplifier.</Tooltip></label>
        <NumberInput value={comp.gain_db} onChange={(v) => onChange({ gain_db: v ?? 0 })} />
      </div>
      <div>
        <label><Tooltip label="NF (dB)">Noise figure.  NF = 10 log10(F), F = noise factor.</Tooltip></label>
        <NumberInput value={comp.nf_db} onChange={(v) => onChange({ nf_db: v ?? 0 })} />
      </div>
      <div>
        <label><Tooltip label="IIP3 (dBm)">Input third-order intercept.  Blank = either specify OIP3 instead or treat as ideally linear.</Tooltip></label>
        <NumberInput value={comp.iip3_dbm} onChange={(v) => onChange({ iip3_dbm: v })} />
      </div>
      <div>
        <label><Tooltip label="OIP3 (dBm)">Output IP3 = IIP3 + gain.  If both IIP3 and OIP3 are supplied, IIP3 is used.</Tooltip></label>
        <NumberInput value={comp.oip3_dbm} onChange={(v) => onChange({ oip3_dbm: v })} />
      </div>
      <div>
        <label><Tooltip label="IP1dB in (dBm)">Input power at which the fundamental output has compressed by 1 dB.  IP1dB is typically ~10 dB below IIP3.</Tooltip></label>
        <NumberInput value={comp.ip1db_in_dbm} onChange={(v) => onChange({ ip1db_in_dbm: v })} />
      </div>
      <div>
        <label><Tooltip label="OP1dB (dBm)">Output 1 dB compression point.</Tooltip></label>
        <NumberInput value={comp.op1db_dbm} onChange={(v) => onChange({ op1db_dbm: v })} />
      </div>
      <div>
        <label>Freq. min</label>
        <HzInput value={comp.freq_min_hz} onChange={(v) => onChange({ freq_min_hz: v })} unit="MHz" />
      </div>
      <div>
        <label>Freq. max</label>
        <HzInput value={comp.freq_max_hz} onChange={(v) => onChange({ freq_max_hz: v })} unit="MHz" />
      </div>
    </div>
  );
}

function FilterFields({
  comp,
  onChange,
}: {
  comp: FilterComponent;
  onChange: (patch: Partial<FilterComponent>) => void;
}) {
  return (
    <div className="form-row">
      <div>
        <label><Tooltip label="Insertion loss (dB)">Loss in the filter passband.  NF of a passive filter equals its insertion loss unless overridden.</Tooltip></label>
        <NumberInput min={0} value={comp.insertion_loss_db} onChange={(v) => onChange({ insertion_loss_db: v ?? 0 })} />
      </div>
      <div>
        <label>NF (dB)</label>
        <NumberInput value={comp.nf_db} onChange={(v) => onChange({ nf_db: v })} />
      </div>
      <div>
        <label>Passband min</label>
        <HzInput value={comp.passband_min_hz} onChange={(v) => onChange({ passband_min_hz: v })} unit="MHz" />
      </div>
      <div>
        <label>Passband max</label>
        <HzInput value={comp.passband_max_hz} onChange={(v) => onChange({ passband_max_hz: v })} unit="MHz" />
      </div>
      <div>
        <label>Stopband rej. (dB)</label>
        <NumberInput value={comp.stopband_rejection_db} onChange={(v) => onChange({ stopband_rejection_db: v })} />
      </div>
    </div>
  );
}

function AttenFields({
  comp,
  onChange,
}: {
  comp: AttenuatorComponent;
  onChange: (patch: Partial<AttenuatorComponent>) => void;
}) {
  return (
    <div className="form-row">
      <div>
        <label><Tooltip label="Attenuation (dB)">Pad loss.  NF defaults to attenuation.</Tooltip></label>
        <NumberInput min={0} value={comp.attenuation_db} onChange={(v) => onChange({ attenuation_db: v ?? 0 })} />
      </div>
      <div>
        <label>NF (dB)</label>
        <NumberInput value={comp.nf_db} onChange={(v) => onChange({ nf_db: v })} />
      </div>
      <div>
        <label>Freq. min</label>
        <HzInput value={comp.freq_min_hz} onChange={(v) => onChange({ freq_min_hz: v })} unit="MHz" />
      </div>
      <div>
        <label>Freq. max</label>
        <HzInput value={comp.freq_max_hz} onChange={(v) => onChange({ freq_max_hz: v })} unit="MHz" />
      </div>
    </div>
  );
}

function MixerFields({
  comp,
  onChange,
}: {
  comp: MixerComponent;
  onChange: (patch: Partial<MixerComponent>) => void;
}) {
  return (
    <div className="form-row">
      <div>
        <label><Tooltip label="Conversion gain (dB)">Signed gain between RF and IF ports.  Passive mixers have negative values (conversion loss).</Tooltip></label>
        <NumberInput value={comp.conversion_gain_db} onChange={(v) => onChange({ conversion_gain_db: v ?? 0 })} />
      </div>
      <div>
        <label>NF (dB)</label>
        <NumberInput value={comp.nf_db} onChange={(v) => onChange({ nf_db: v ?? 0 })} />
      </div>
      <div>
        <label>IIP3 (dBm)</label>
        <NumberInput value={comp.iip3_dbm} onChange={(v) => onChange({ iip3_dbm: v })} />
      </div>
      <div>
        <label>OIP3 (dBm)</label>
        <NumberInput value={comp.oip3_dbm} onChange={(v) => onChange({ oip3_dbm: v })} />
      </div>
      <div>
        <label>IP1dB in (dBm)</label>
        <NumberInput value={comp.ip1db_in_dbm} onChange={(v) => onChange({ ip1db_in_dbm: v })} />
      </div>
      <div>
        <label><Tooltip label="LO (Hz)">Local oscillator frequency.</Tooltip></label>
        <HzInput value={comp.lo_frequency_hz} onChange={(v) => onChange({ lo_frequency_hz: v ?? 0 })} unit="MHz" />
      </div>
      <div>
        <label><Tooltip label="Sideband">Lower sideband IF = |RF - LO|.  Upper sideband IF = RF + LO.</Tooltip></label>
        <select
          value={comp.sideband}
          onChange={(e) => onChange({ sideband: e.target.value as 'lower' | 'upper' })}
        >
          <option value="lower">lower (|RF - LO|)</option>
          <option value="upper">upper (RF + LO)</option>
        </select>
      </div>
      <div>
        <label>LO power (dBm)</label>
        <NumberInput value={comp.lo_power_dbm} onChange={(v) => onChange({ lo_power_dbm: v })} />
      </div>
      <div>
        <label>LO-RF isolation (dB)</label>
        <NumberInput value={comp.lo_rf_isolation_db} onChange={(v) => onChange({ lo_rf_isolation_db: v })} />
      </div>
    </div>
  );
}
