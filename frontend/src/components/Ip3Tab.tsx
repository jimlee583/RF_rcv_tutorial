import { explainIp3Change } from '../explain';
import { formatDb, formatDbm } from '../format';
import type { ReceiverStore } from '../state/receiverStore';
import type { Ip3Store, LinkedField } from '../state/ip3Store';
import { LINKED_FIELDS } from '../state/ip3Store';
import { Ip3Chart } from './Ip3Chart';
import { NumberField } from './NumberField';
import { Tooltip } from './Tooltip';

const LINKED_SET: ReadonlySet<string> = new Set(LINKED_FIELDS);

export function Ip3Tab({ store, ip3 }: { store: ReceiverStore; ip3: Ip3Store }) {
  const { state, effective, setParams, setLinked, loadSpecExample } = ip3;
  const p = effective;
  const locked = (field: LinkedField) => state.linked && LINKED_SET.has(field);
  const cascadeTotals = store.state.result?.totals ?? null;
  const result = state.result;
  const note = explainIp3Change(
    state.previousResult,
    state.result,
    state.previousParams,
    state.resultParams,
  );

  return (
    <div>
      <div className="callout">
        Small-signal two-tone model: the fundamental has slope 1 dB/dB, IM3 has
        slope 3 dB/dB, and they meet at the extrapolated IP3. Solid traces are
        inside the trustworthy region (at or below input P1dB, or IIP3 − 10 dB
        when P1dB is unknown). Dashed traces and the IP3 marker are
        extrapolations, not a saturation power.
      </div>

      {note && <div className="change-strip">{note}</div>}

      <div className="panel">
        <h2>
          Receiver
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={loadSpecExample}
              title="IIP3 = 0 dBm, N ≈ −120 dBm, SFDR = 80 dB"
            >
              Spec example
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85em', margin: 0 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={state.linked}
                onChange={(e) => setLinked(e.target.checked)}
              />
              Follow the Receiver cascade tab
            </label>
          </span>
        </h2>
        {state.linked && (
          <div style={{ color: 'var(--fg-dim)', fontSize: '0.85em', marginBottom: 8 }}>
            Using cascaded IIP3 {formatDbm(cascadeTotals?.iip3_dbm ?? null, 1)}, gain{' '}
            {cascadeTotals ? `${cascadeTotals.gain_db.toFixed(1)} dB` : '--'}, NF{' '}
            {cascadeTotals ? `${cascadeTotals.nf_db.toFixed(2)} dB` : '--'}, B{' '}
            {cascadeTotals ? `${(cascadeTotals.bandwidth_hz / 1e3).toFixed(0)} kHz` : '--'}.
            Untick to edit these here, or load the spec example (unlinks).
          </div>
        )}
        <div className="form-row">
          <NumberField
            label="Input IP3"
            help="Cascaded IIP3. Each +1 dB of IIP3 drops IM3 by 2 dB at the same Pin and adds 2/3 dB of SFDR."
            value={p.iip3_dbm}
            unit="dBm"
            disabled={locked('iip3_dbm')}
            onChange={(v) => v !== null && setParams({ iip3_dbm: v })}
          />
          <NumberField
            label="Total gain"
            help="Moves both curves and OIP3 by the same amount. SFDR does not change because it is input-referred."
            value={p.gain_db}
            unit="dB"
            disabled={locked('gain_db')}
            onChange={(v) => v !== null && setParams({ gain_db: v })}
          />
          <NumberField
            label="Noise figure"
            help="Cascaded NF. Noise floor N = kTB + NF. Raising NF by 1 dB shrinks SFDR by 2/3 dB."
            value={p.nf_db}
            unit="dB"
            disabled={locked('nf_db')}
            onChange={(v) => v !== null && setParams({ nf_db: v })}
          />
          <NumberField
            label="Bandwidth"
            help="Receiver noise bandwidth B. Doubling B raises the noise floor 3 dB and cuts SFDR by 2 dB."
            value={p.bandwidth_hz}
            scale={1e3}
            unit="kHz"
            min={0.001}
            disabled={locked('bandwidth_hz')}
            onChange={(v) => v !== null && setParams({ bandwidth_hz: v })}
          />
          <NumberField
            label="Temperature"
            help="Physical temperature for kTB. Standard T0 = 290 K."
            value={p.temperature_k}
            unit="K"
            min={1}
            disabled={locked('temperature_k')}
            onChange={(v) => v !== null && setParams({ temperature_k: v })}
          />
          <NumberField
            label="Input P1dB"
            help="Upper edge of the solid-line region. Blank uses IIP3 − 10 dB, a common amplifier rule of thumb. IP3 is still drawn as an extrapolation past this point."
            value={p.ip1db_in_dbm}
            unit="dBm (blank = IIP3 − 10)"
            nullable
            disabled={locked('ip1db_in_dbm')}
            onChange={(v) => setParams({ ip1db_in_dbm: v })}
          />
          <NumberField
            label="Pin min"
            help="Left edge of the sweep. Set low enough to show the noise floor and the IM3 crossing."
            value={p.pin_min_dbm}
            unit="dBm"
            onChange={(v) => v !== null && setParams({ pin_min_dbm: v })}
          />
          <NumberField
            label="Pin max"
            help="Right edge of the sweep. Blank extends ~10 dB past IIP3 so the intercept is on screen."
            value={p.pin_max_dbm}
            unit="dBm (blank = IIP3 + 10)"
            nullable
            onChange={(v) => setParams({ pin_max_dbm: v })}
          />
        </div>
      </div>

      {state.error && (
        <div className="warn-item error" style={{ marginBottom: 12 }}>
          <strong>ERROR: </strong>
          {state.error}
        </div>
      )}

      {result ? (
        <>
          <div className="summary-strip" style={{ borderRadius: 8, marginBottom: 12 }}>
            <Metric
              label={<Tooltip label="OIP3">OIP3 = IIP3 + G. The intercept's y-coordinate.</Tooltip>}
              value={formatDbm(result.oip3_dbm, 1)}
            />
            <Metric
              label={<Tooltip label="N (input)">kTB + NF, referred to the receiver input.</Tooltip>}
              value={formatDbm(result.noise_floor_in_dbm, 1)}
            />
            <Metric
              label={<Tooltip label="N (output)">Input noise floor plus total gain.</Tooltip>}
              value={formatDbm(result.noise_floor_out_dbm, 1)}
            />
            <Metric
              label={
                <Tooltip label="SFDR3">
                  (2/3)(IIP3 − N). Equal to Pin|IM3=N minus N, and to the vertical
                  green span on the plot.
                </Tooltip>
              }
              value={formatDb(result.sfdr3_db, 1)}
            />
            <Metric
              label={
                <Tooltip label="Pin | IM3 = N">
                  Input power where a two-tone IM3 product equals the noise floor:
                  (N + 2 IIP3) / 3. Two equal tones at this Pin put IM3 on N.
                </Tooltip>
              }
              value={formatDbm(result.pin_at_im3_eq_noise_dbm, 1)}
            />
            <Metric
              label={
                <Tooltip label="Valid to">
                  {result.valid_region_source === 'ip1db'
                    ? 'Supplied input P1dB. Above this the cubic model is not physical.'
                    : 'IIP3 − 10 dB (no P1dB given). Typical amplifiers compress ~9–12 dB below IIP3.'}
                </Tooltip>
              }
              value={formatDbm(result.valid_region_max_dbm, 1)}
            />
            <Metric label="Status" value={state.loading ? 'Updating...' : 'Up to date'} />
          </div>

          <div className="panel">
            <h2>Output power versus input power</h2>
            <Ip3Chart result={result} />
            <div className="legend">
              <span>
                <span className="swatch" style={{ background: 'rgba(34,197,94,0.6)' }} />
                Trustworthy region (solid)
              </span>
              <span>
                <span className="swatch" style={{ background: 'rgba(239,68,68,0.6)' }} />
                Extrapolated (dashed)
              </span>
              <span>
                <span className="swatch" style={{ background: '#22c55e' }} />
                SFDR at Pin where IM3 = N
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="panel">{state.loading ? 'Computing IP3 curve...' : 'Waiting for IP3 curve...'}</div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
