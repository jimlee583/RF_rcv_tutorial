import { formatDbm, formatHz } from '../format';
import type { ReceiverStore } from '../state/receiverStore';
import type { LinkedField, SpectrumParams, SpectrumStore } from '../state/spectrumStore';
import { LINKED_FIELDS } from '../state/spectrumStore';
import { NumberField } from './NumberField';
import { SpectrumChart, SpectrumLineTable } from './SpectrumChart';
import { Tooltip } from './Tooltip';
import { WarningList } from './WarningList';

const LINKED_SET: ReadonlySet<string> = new Set(LINKED_FIELDS);

export function SpectrumTab({
  store,
  spectrum,
}: {
  store: ReceiverStore;
  spectrum: SpectrumStore;
}) {
  const { state, effective, setParams, setLinked, resetTones } = spectrum;
  const p = effective;
  const locked = (field: LinkedField) => state.linked && LINKED_SET.has(field);
  const set = <K extends keyof SpectrumParams>(key: K) => (v: SpectrumParams[K]) =>
    setParams({ [key]: v } as Partial<SpectrumParams>);

  const cascadeTotals = store.state.result?.totals ?? null;
  const result = state.result;
  const im3Rf = result?.rf.lines.filter((l) => l.category === 'im3') ?? [];
  const im3Margin =
    im3Rf.length && result ? Math.max(...im3Rf.map((l) => l.power_dbm)) - result.noise_floor_dbm : null;

  return (
    <div>
      <div className="callout">
        Two tones at the receiver input, the third-order products they create, and what
        comes out of the mixer. The <strong>RF</strong> plot is referred to the receiver
        input (IM3 shown as input-equivalent levels from the cascaded IIP3); the{' '}
        <strong>IF</strong> plot is referred to the receiver output (all levels raised by the
        total gain). Hollow markers are illustrative levels, not calculated ones.
      </div>

      <div className="panel">
        <h2>
          Two-tone source
          <button onClick={resetTones} title="Restore the 2.09 / 2.11 GHz, -40 dBm example">
            Spec example
          </button>
        </h2>
        <div className="form-row">
          <NumberField
            label="Tone 1 frequency"
            help="First RF input tone, f1."
            value={p.f1_hz}
            scale={1e6}
            unit="MHz"
            min={0.000001}
            onChange={(v) => v !== null && setParams({ f1_hz: v })}
          />
          <NumberField
            label="Tone 1 power"
            help="Input power of tone 1 at the receiver input."
            value={p.p1_dbm}
            unit="dBm"
            onChange={(v) => v !== null && setParams({ p1_dbm: v })}
          />
          <NumberField
            label="Tone 2 frequency"
            help="Second RF input tone, f2.  Tone spacing sets where 2f1-f2 and 2f2-f1 fall."
            value={p.f2_hz}
            scale={1e6}
            unit="MHz"
            min={0.000001}
            onChange={(v) => v !== null && setParams({ f2_hz: v })}
          />
          <NumberField
            label="Tone 2 power"
            help="Input power of tone 2.  Unequal tones give unequal IM3 products: P(2f1-f2) = 2P1 + P2 - 2 IIP3."
            value={p.p2_dbm}
            unit="dBm"
            onChange={(v) => v !== null && setParams({ p2_dbm: v })}
          />
        </div>
      </div>

      <div className="panel">
        <h2>
          Receiver
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85em', margin: 0 }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={state.linked}
              onChange={(e) => setLinked(e.target.checked)}
            />
            Follow the Receiver cascade tab
          </label>
        </h2>
        {state.linked && (
          <div style={{ color: 'var(--fg-dim)', fontSize: '0.85em', marginBottom: 8 }}>
            Using cascaded IIP3 {formatDbm(cascadeTotals?.iip3_dbm ?? null, 1)}, gain{' '}
            {cascadeTotals ? `${cascadeTotals.gain_db.toFixed(1)} dB` : '--'}, NF{' '}
            {cascadeTotals ? `${cascadeTotals.nf_db.toFixed(2)} dB` : '--'}
            {spectrum.cascadeHasMixer
              ? ` and the first mixer's LO (${formatHz(p.lo_hz)}, ${p.sideband} sideband).`
              : '. No mixer in the cascade; LO uses the last manual value.'}{' '}
            Untick to edit these here.
          </div>
        )}
        <div className="form-row">
          <NumberField
            label="LO frequency"
            help="Local oscillator.  Lower sideband gives IF = |f_RF - f_LO| (downconversion); upper gives f_RF + f_LO."
            value={p.lo_hz}
            scale={1e6}
            unit="MHz"
            min={0.000001}
            disabled={locked('lo_hz')}
            onChange={(v) => v !== null && setParams({ lo_hz: v })}
          />
          <div>
            <label>
              <Tooltip label="Sideband">Which mixer output is the wanted IF.</Tooltip>
            </label>
            <select
              value={p.sideband}
              disabled={locked('sideband')}
              onChange={(e) => setParams({ sideband: e.target.value as 'lower' | 'upper' })}
            >
              <option value="lower">lower (|RF - LO|)</option>
              <option value="upper">upper (RF + LO)</option>
            </select>
          </div>
          <NumberField
            label="Receiver IIP3"
            help="Cascaded input-referred third-order intercept.  Each 1 dB increase lowers both IM3 products by 2 dB."
            value={p.iip3_dbm}
            unit="dBm"
            disabled={locked('iip3_dbm')}
            onChange={(v) => v !== null && setParams({ iip3_dbm: v })}
          />
          <NumberField
            label="Receiver IIP2"
            help="Optional input-referred second-order intercept.  Leave blank to omit IM2 products (f1 +/- f2)."
            value={p.iip2_dbm}
            unit="dBm (blank = omit)"
            nullable
            onChange={set('iip2_dbm')}
          />
          <NumberField
            label="Total gain"
            help="Receiver gain from input to the IF plot's reference plane."
            value={p.gain_db}
            unit="dB"
            disabled={locked('gain_db')}
            onChange={(v) => v !== null && setParams({ gain_db: v })}
          />
          <NumberField
            label="Noise figure"
            help="Cascaded NF.  Noise floor = kTB + NF."
            value={p.nf_db}
            unit="dB"
            disabled={locked('nf_db')}
            onChange={(v) => v !== null && setParams({ nf_db: v })}
          />
          <NumberField
            label="Bandwidth"
            help="Receiver noise bandwidth B for the noise floor.  Also the default analyzer RBW."
            value={p.bandwidth_hz}
            scale={1e3}
            unit="kHz"
            min={0.001}
            disabled={locked('bandwidth_hz')}
            onChange={(v) => v !== null && setParams({ bandwidth_hz: v })}
          />
          <NumberField
            label="Temperature"
            help="Reference temperature for kTB.  Standard T0 = 290 K."
            value={p.temperature_k}
            unit="K"
            min={1}
            disabled={locked('temperature_k')}
            onChange={(v) => v !== null && setParams({ temperature_k: v })}
          />
        </div>
      </div>

      <div className="panel">
        <h2>Analyzer and mixer products</h2>
        <div className="form-row">
          <NumberField
            label="Analyzer RBW"
            help="Resolution bandwidth of the simulated trace.  Narrower RBW lowers the displayed noise (kT*RBW + NF) and sharpens the peaks.  Blank = receiver bandwidth."
            value={p.rbw_hz}
            scale={1e3}
            unit="kHz (blank = bandwidth)"
            min={0.001}
            nullable
            onChange={set('rbw_hz')}
          />
          <div>
            <label>
              <Tooltip label="Mixer spurs">
                Enumerate m*RF +/- n*LO products from each tone.  Levels are illustrative
                (generic diode-mixer behaviour) and marked as such.
              </Tooltip>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg)', fontSize: '1em' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={p.include_mixer_spurs}
                onChange={(e) => setParams({ include_mixer_spurs: e.target.checked })}
              />
              show spurs
            </label>
          </div>
          <NumberField
            label="Max harmonic order"
            help="Highest m and n used for mixer spurs and LO harmonics (1-7)."
            value={p.mixer_spur_order_max}
            unit="order"
            step={1}
            min={1}
            onChange={(v) =>
              v !== null && setParams({ mixer_spur_order_max: Math.min(7, Math.max(1, Math.round(v))) })
            }
          />
          <NumberField
            label="LO power"
            help="LO drive level, used for LO leakage lines.  Blank = illustrative +7 dBm."
            value={p.lo_power_dbm}
            unit="dBm (blank = +7 est.)"
            nullable
            disabled={locked('lo_power_dbm')}
            onChange={set('lo_power_dbm')}
          />
          <NumberField
            label="LO-RF isolation"
            help="How far LO leakage at the mixer RF port is below the LO drive.  Blank = illustrative 25 dB."
            value={p.lo_rf_isolation_db}
            unit="dB (blank = 25 est.)"
            min={0}
            nullable
            disabled={locked('lo_rf_isolation_db')}
            onChange={set('lo_rf_isolation_db')}
          />
          <NumberField
            label="LO-IF isolation"
            help="How far LO feedthrough at the IF port is below the LO drive.  Blank = illustrative 25 dB."
            value={p.lo_if_isolation_db}
            unit="dB (blank = 25 est.)"
            min={0}
            nullable
            onChange={set('lo_if_isolation_db')}
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
            <Metric label="IF tones" value={`${formatHz(result.if.lines.find((l) => l.label === 'Tone 1 at IF')?.frequency_hz)} / ${formatHz(result.if.lines.find((l) => l.label === 'Tone 2 at IF')?.frequency_hz)}`} />
            <Metric label="IM3 at RF" value={im3Rf.map((l) => formatHz(l.frequency_hz)).join(' / ')} />
            <Metric label="IM3 level (input)" value={im3Rf.map((l) => formatDbm(l.power_dbm, 1)).join(' / ')} />
            <Metric label="Noise floor (input)" value={formatDbm(result.noise_floor_dbm, 1)} />
            <Metric
              label="IM3 above noise"
              value={im3Margin === null ? '--' : `${im3Margin.toFixed(1)} dB`}
            />
            <Metric label="Status" value={state.loading ? 'Updating...' : 'Up to date'} />
          </div>

          <div className="grid-2">
            <div className="panel">
              <SpectrumChart
                title="RF spectrum (before downconversion)"
                subtitle="Referred to the receiver input. Receiver noise floor = kTB + NF."
                side={result.rf}
              />
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--fg-dim)' }}>
                  {result.rf.lines.length} spectral lines
                </summary>
                <SpectrumLineTable side={result.rf} />
              </details>
            </div>
            <div className="panel">
              <SpectrumChart
                title="IF spectrum (after downconversion)"
                subtitle="Referred to the receiver output (input levels + total gain). Off-span products are listed in the table."
                side={result.if}
              />
              <details>
                <summary style={{ cursor: 'pointer', color: 'var(--fg-dim)' }}>
                  {result.if.lines.length} spectral lines
                </summary>
                <SpectrumLineTable side={result.if} />
              </details>
            </div>
          </div>

          <div className="panel">
            <h2>Notes</h2>
            <WarningList warnings={result.warnings} />
            {!result.warnings.length && (
              <div style={{ color: 'var(--fg-dim)' }}>No warnings for this setup.</div>
            )}
          </div>
        </>
      ) : (
        <div className="panel">{state.loading ? 'Computing spectrum...' : 'Waiting for spectrum...'}</div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
