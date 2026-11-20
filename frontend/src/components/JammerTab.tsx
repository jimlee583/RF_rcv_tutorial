import type { ReactNode } from 'react';

import { formatDb, formatDbm } from '../format';
import type { JammerStore } from '../state/jammerStore';
import { LINKED_FIELDS } from '../state/jammerStore';
import type { JammerParams, JammerKind } from '../state/jammerStore';
import type { ReceiverStore } from '../state/receiverStore';
import type { JammerScenario } from '../types';
import { JammerChart } from './JammerChart';
import { NumberField } from './NumberField';
import { Tooltip } from './Tooltip';
import { WarningList } from './WarningList';

const LINKED_SET: ReadonlySet<string> = new Set(LINKED_FIELDS);

export function JammerTab({
  store,
  jammer,
}: {
  store: ReceiverStore;
  jammer: JammerStore;
}) {
  const { state, effective, setParams, setLinked, setKind, setAgcShown, loadPreset } = jammer;
  const p = effective;
  const locked = (field: keyof JammerParams) => state.linked && LINKED_SET.has(field as string);
  const cascadeTotals = store.state.result?.totals ?? null;
  const result = state.result;

  const shown: JammerScenario | null =
    result
      ? state.agcShown === 'on'
        ? result.scenario_on ?? result.scenario_off
        : result.scenario_off
      : null;

  return (
    <div>
      <div className="callout">
        <strong>What a jammer actually does.</strong> A noise jammer raises the floor
        only by the power that falls <em>inside</em> the receiver bandwidth; a CW
        jammer only hurts the desired signal when its IM3 product lands on the
        channel. Filtering does not change kTB — it changes how much jammer power
        reaches the nonlinear stage. An AGC pad restores linearity and costs noise
        figure, but it cannot beat a jammer that is already inside the channel.
      </div>

      <div className="panel">
        <h2>
          Scenario
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => loadPreset('in_band_noise')} title="Narrow noise jammer centered on the desired channel">
              In-band noise
            </button>
            <button onClick={() => loadPreset('out_of_band_noise')} title="Strong noise jammer well outside the preselect">
              Out-of-band noise
            </button>
            <button onClick={() => loadPreset('im3_on_channel')} title="Two CW tones outside B whose 2 f1 - f2 lands on the desired frequency">
              IM3 on channel
            </button>
            <button onClick={() => loadPreset('compressing_cw')} title="Strong CW jammer well above P1dB">
              Compressing CW
            </button>
          </span>
        </h2>
        <div className="form-row">
          <div>
            <label>
              <Tooltip label="Jammer kind">
                Noise is a flat spectrum with user-set bandwidth; CW is one or two tones.
                Only in-channel power lands on the floor; only CW produces IM3.
              </Tooltip>
            </label>
            <select
              value={state.kind}
              onChange={(e) => setKind(e.target.value as JammerKind)}
            >
              <option value="noise">Noise jammer</option>
              <option value="cw">CW jammer (1 or 2 tones)</option>
            </select>
          </div>
          <div>
            <label>
              <Tooltip label="AGC / input pad">
                With AGC on, an input attenuator is sized so the front-end power
                sits at ‘AGC backoff’ dB under input P1dB. The pad protects P1dB
                at the cost of noise figure; it does nothing for in-channel C/I.
              </Tooltip>
            </label>
            <select
              value={state.agcShown}
              onChange={(e) => setAgcShown(e.target.value as 'off' | 'on')}
              disabled={result?.scenario_on === null || result?.scenario_on === undefined}
            >
              <option value="off">AGC off</option>
              <option value="on">AGC on</option>
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85em', margin: 0 }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={state.linked}
              onChange={(e) => setLinked(e.target.checked)}
            />
            Follow the Receiver cascade tab
          </label>
        </div>
        {state.linked && (
          <div style={{ color: 'var(--fg-dim)', fontSize: '0.85em', marginTop: 6 }}>
            Using cascaded IIP3 {formatDbm(cascadeTotals?.iip3_dbm ?? null, 1)}, NF{' '}
            {cascadeTotals ? `${cascadeTotals.nf_db.toFixed(2)} dB` : '--'}, B{' '}
            {cascadeTotals ? `${(cascadeTotals.bandwidth_hz / 1e3).toFixed(0)} kHz` : '--'},
            input P1dB{' '}
            {formatDbm(cascadeTotals?.input_p1db_estimate_dbm ?? null, 1)}, preselect{' '}
            <em>{p.preselect_label}</em>. Untick to edit here.
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Desired signal and receiver</h2>
        <div className="form-row">
          <NumberField
            label="Desired frequency"
            help="Center frequency of the wanted signal at the antenna."
            value={p.desired_f_hz}
            scale={1e6}
            unit="MHz"
            min={0.000001}
            disabled={locked('desired_f_hz')}
            onChange={(v) => v !== null && setParams({ desired_f_hz: v })}
          />
          <NumberField
            label="Desired power"
            help="Antenna-referred signal power."
            value={p.desired_p_dbm}
            unit="dBm"
            onChange={(v) => v !== null && setParams({ desired_p_dbm: v })}
          />
          <NumberField
            label="Required SNR"
            help="Demodulator threshold. The SNR margin is current SNR minus this."
            value={p.required_snr_db}
            unit="dB"
            onChange={(v) => v !== null && setParams({ required_snr_db: v })}
          />
          <NumberField
            label="Receiver IIP3"
            help="Cascaded input-referred third-order intercept. Sets CW IM3."
            value={p.iip3_dbm}
            unit="dBm"
            disabled={locked('iip3_dbm')}
            onChange={(v) => v !== null && setParams({ iip3_dbm: v })}
          />
          <NumberField
            label="Noise figure"
            help="Cascaded NF. Thermal floor = kTB + NF."
            value={p.nf_db}
            unit="dB"
            disabled={locked('nf_db')}
            onChange={(v) => v !== null && setParams({ nf_db: v })}
          />
          <NumberField
            label="Bandwidth"
            help="Receiver noise bandwidth B. A wider B lets more noise jammer in."
            value={p.bandwidth_hz}
            scale={1e3}
            unit="kHz"
            min={0.001}
            disabled={locked('bandwidth_hz')}
            onChange={(v) => v !== null && setParams({ bandwidth_hz: v })}
          />
          <NumberField
            label="Temperature"
            help="Reference temperature for kTB. 290 K standard."
            value={p.temperature_k}
            unit="K"
            min={1}
            disabled={locked('temperature_k')}
            onChange={(v) => v !== null && setParams({ temperature_k: v })}
          />
          <NumberField
            label="Input P1dB"
            help="Cascaded input compression point (estimate). Blank = AGC and compression hidden."
            value={p.input_p1db_dbm}
            unit="dBm (blank = unknown)"
            nullable
            disabled={locked('input_p1db_dbm')}
            onChange={(v) => setParams({ input_p1db_dbm: v })}
          />
          <NumberField
            label="AGC backoff"
            help="Headroom target between the front-end power and input P1dB when the pad engages."
            value={p.agc_backoff_db}
            unit="dB"
            min={0}
            onChange={(v) => v !== null && setParams({ agc_backoff_db: v })}
          />
        </div>
      </div>

      <div className="panel">
        <h2>Preselect filter</h2>
        <div className="form-row">
          <NumberField
            label="Passband min"
            help="Lower edge of the first filter in the chain. Jammers inside pass through; outside are reduced by the stopband rejection."
            value={p.preselect_passband_min_hz}
            scale={1e6}
            unit="MHz (blank = no filter)"
            nullable
            disabled={locked('preselect_passband_min_hz')}
            onChange={(v) => setParams({ preselect_passband_min_hz: v })}
          />
          <NumberField
            label="Passband max"
            help="Upper edge of the preselect."
            value={p.preselect_passband_max_hz}
            scale={1e6}
            unit="MHz (blank = no filter)"
            nullable
            disabled={locked('preselect_passband_max_hz')}
            onChange={(v) => setParams({ preselect_passband_max_hz: v })}
          />
          <NumberField
            label="Stopband rejection"
            help="How many dB the preselect knocks a jammer down once it is outside the passband. Brick-wall model, applied from the jammer's center frequency."
            value={p.preselect_stopband_rejection_db}
            unit="dB (blank = 0)"
            min={0}
            nullable
            disabled={locked('preselect_stopband_rejection_db')}
            onChange={(v) => setParams({ preselect_stopband_rejection_db: v })}
          />
        </div>
      </div>

      {state.kind === 'noise' && (
        <div className="panel">
          <h2>Noise jammer</h2>
          <div className="form-row">
            <NumberField
              label="Center frequency"
              help="Jammer center. Inside the preselect passes with no extra attenuation; outside is reduced by the stopband rejection."
              value={p.noise?.f_center_hz ?? null}
              scale={1e6}
              unit="MHz"
              min={0.000001}
              onChange={(v) =>
                v !== null &&
                setParams({
                  noise: {
                    p_dbm: p.noise?.p_dbm ?? -85,
                    bandwidth_hz: p.noise?.bandwidth_hz ?? p.bandwidth_hz,
                    f_center_hz: v,
                  },
                })
              }
            />
            <NumberField
              label="Total power"
              help="Jammer total power at the antenna. A wider jammer spreads this power over its bandwidth; only the slice inside B hits the floor."
              value={p.noise?.p_dbm ?? null}
              unit="dBm"
              onChange={(v) =>
                v !== null &&
                setParams({
                  noise: {
                    f_center_hz: p.noise?.f_center_hz ?? p.desired_f_hz,
                    bandwidth_hz: p.noise?.bandwidth_hz ?? p.bandwidth_hz,
                    p_dbm: v,
                  },
                })
              }
            />
            <NumberField
              label="Jammer bandwidth"
              help="Rectangular (flat) spectrum. 10x wider than B spreads total power over 10 bins, so the in-band slice is 10 dB down from the total."
              value={p.noise?.bandwidth_hz ?? null}
              scale={1e3}
              unit="kHz"
              min={0.001}
              onChange={(v) =>
                v !== null &&
                setParams({
                  noise: {
                    f_center_hz: p.noise?.f_center_hz ?? p.desired_f_hz,
                    p_dbm: p.noise?.p_dbm ?? -85,
                    bandwidth_hz: v,
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {state.kind === 'cw' && (
        <div className="panel">
          <h2>CW jammer tones</h2>
          <div className="form-row">
            <NumberField
              label="Tone 1 frequency"
              help="First CW jammer tone, f1."
              value={p.cw_tones?.[0]?.f_hz ?? null}
              scale={1e6}
              unit="MHz"
              min={0.000001}
              onChange={(v) => {
                if (v === null) return;
                const t1 = { f_hz: v, p_dbm: p.cw_tones?.[0]?.p_dbm ?? -40 };
                const t2 = p.cw_tones?.[1] ?? null;
                setParams({ cw_tones: t2 ? [t1, t2] : [t1] });
              }}
            />
            <NumberField
              label="Tone 1 power"
              help="Antenna power of tone 1."
              value={p.cw_tones?.[0]?.p_dbm ?? null}
              unit="dBm"
              onChange={(v) => {
                if (v === null) return;
                const t1 = { f_hz: p.cw_tones?.[0]?.f_hz ?? p.desired_f_hz, p_dbm: v };
                const t2 = p.cw_tones?.[1] ?? null;
                setParams({ cw_tones: t2 ? [t1, t2] : [t1] });
              }}
            />
            <NumberField
              label="Tone 2 frequency"
              help="Optional second tone. Set so 2 f1 - f2 or 2 f2 - f1 lands on the desired frequency to see IM3 blockage."
              value={p.cw_tones?.[1]?.f_hz ?? null}
              scale={1e6}
              unit="MHz (blank = off)"
              min={0.000001}
              nullable
              onChange={(v) => {
                const t1 = p.cw_tones?.[0] ?? {
                  f_hz: p.desired_f_hz,
                  p_dbm: -40,
                };
                if (v === null) {
                  setParams({ cw_tones: [t1] });
                } else {
                  const t2 = {
                    f_hz: v,
                    p_dbm: p.cw_tones?.[1]?.p_dbm ?? t1.p_dbm,
                  };
                  setParams({ cw_tones: [t1, t2] });
                }
              }}
            />
            <NumberField
              label="Tone 2 power"
              help="Only used when tone 2 frequency is set."
              value={p.cw_tones?.[1]?.p_dbm ?? null}
              unit="dBm"
              nullable
              onChange={(v) => {
                if (v === null) return;
                const t1 = p.cw_tones?.[0];
                const t2 = p.cw_tones?.[1];
                if (!t1 || !t2) return;
                setParams({ cw_tones: [t1, { ...t2, p_dbm: v }] });
              }}
            />
          </div>
          <div style={{ color: 'var(--fg-dim)', fontSize: '0.85em', marginTop: 6 }}>
            One tone alone never puts IM3 on the desired bin: the products of a
            tone at offset Δ sit at −Δ and +2Δ from the channel. Use two tones
            when you want to see the IM3 case.
          </div>
        </div>
      )}

      {state.error && (
        <div className="warn-item error" style={{ marginBottom: 12 }}>
          <strong>ERROR: </strong>
          {state.error}
        </div>
      )}

      {result && shown ? (
        <>
          <div className="summary-strip" style={{ borderRadius: 8, marginBottom: 12 }}>
            <Metric
              label={<Tooltip label="Thermal floor">kTB + NF without any pad.</Tooltip>}
              value={formatDbm(result.thermal_floor_dbm, 1)}
            />
            <Metric
              label={
                <Tooltip label="Effective floor">
                  Thermal floor power-summed with any jammer power that lands inside B.
                </Tooltip>
              }
              value={formatDbm(shown.effective_floor_dbm, 1)}
            />
            <Metric
              label={<Tooltip label="SNR">Desired power minus effective floor.</Tooltip>}
              value={formatDb(shown.snr_db, 1)}
            />
            <Metric
              label={
                <Tooltip label="SNR margin">
                  SNR minus the required-SNR threshold. Positive = link closes.
                </Tooltip>
              }
              value={formatDb(shown.snr_margin_db, 1)}
            />
            <Metric
              label={<Tooltip label="P1dB headroom">input P1dB minus front-end power.</Tooltip>}
              value={formatOrDash(shown.p1db_headroom_db, 'dB')}
            />
            <Metric
              label={
                <Tooltip label="AGC pad">
                  Attenuation added ahead of the cascade. Zero when the front end
                  is already under the backoff target or when no P1dB is given.
                </Tooltip>
              }
              value={`${shown.pad_db.toFixed(1)} dB`}
            />
            <Metric label="Status" value={state.loading ? 'Updating...' : 'Up to date'} />
          </div>

          <ScenarioCompareStrip
            off={result.scenario_off}
            on={result.scenario_on}
          />

          <div className="panel">
            <h2>
              Input-referred spectrum ({state.agcShown === 'on' ? 'AGC on' : 'AGC off'})
            </h2>
            <JammerChart scenario={shown} params={p} />
            <div className="legend" style={{ marginTop: 8 }}>
              <span>
                <span className="swatch" style={{ background: 'rgba(34, 197, 94, 0.4)' }} />
                Receiver channel (B)
              </span>
              <span>
                <span className="swatch" style={{ background: 'rgba(148, 163, 184, 0.3)' }} />
                Preselect stopband
              </span>
              <span>
                <span className="swatch" style={{ background: '#22c55e' }} />
                Desired signal
              </span>
              <span>
                <span className="swatch" style={{ background: 'rgba(249, 115, 22, 0.6)' }} />
                Noise jammer (bar height = power inside B)
              </span>
              <span>
                <span className="swatch" style={{ background: '#f59e0b' }} />
                CW jammer
              </span>
              <span>
                <span className="swatch" style={{ background: '#ef4444' }} />
                IM3 ({shown.im3_valid ? 'valid' : 'extrapolated — above P1dB'})
              </span>
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
        <div className="panel">
          {state.loading ? 'Computing jammer impact...' : 'Waiting for jammer response...'}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function formatOrDash(v: number | null, unit: string, digits = 1): string {
  if (v === null || !Number.isFinite(v)) return '--';
  return `${v.toFixed(digits)} ${unit}`;
}

/** Side-by-side AGC comparison so the trade is visible without hunting. */
function ScenarioCompareStrip({
  off,
  on,
}: {
  off: JammerScenario;
  on: JammerScenario | null;
}) {
  const rows: { label: ReactNode; off: string; on: string }[] = [
    {
      label: <Tooltip label="Pad">Input attenuation ahead of the cascade.</Tooltip>,
      off: `${off.pad_db.toFixed(1)} dB`,
      on: on ? `${on.pad_db.toFixed(1)} dB` : '--',
    },
    {
      label: <Tooltip label="NF">Noise figure after the pad. Each dB of pad adds 1 dB of NF.</Tooltip>,
      off: `${off.nf_db.toFixed(2)} dB`,
      on: on ? `${on.nf_db.toFixed(2)} dB` : '--',
    },
    {
      label: <Tooltip label="IIP3 (input-referred)">Pad raises input IIP3 by the pad value.</Tooltip>,
      off: formatDbm(off.iip3_dbm, 1),
      on: on ? formatDbm(on.iip3_dbm, 1) : '--',
    },
    {
      label: <Tooltip label="Thermal floor">kTB + NF after the pad.</Tooltip>,
      off: formatDbm(off.thermal_floor_dbm, 1),
      on: on ? formatDbm(on.thermal_floor_dbm, 1) : '--',
    },
    {
      label: <Tooltip label="Jammer in channel">Jammer power inside B after the pad.</Tooltip>,
      off: off.jammer_in_channel_dbm === null ? 'none' : formatDbm(off.jammer_in_channel_dbm, 1),
      on: on
        ? on.jammer_in_channel_dbm === null
          ? 'none'
          : formatDbm(on.jammer_in_channel_dbm, 1)
        : '--',
    },
    {
      label: <Tooltip label="Effective floor">Thermal + in-channel jammer, power summed.</Tooltip>,
      off: formatDbm(off.effective_floor_dbm, 1),
      on: on ? formatDbm(on.effective_floor_dbm, 1) : '--',
    },
    {
      label: <Tooltip label="Front-end power">What the first compressing stage sees.</Tooltip>,
      off: off.front_end_power_dbm === null ? 'none' : formatDbm(off.front_end_power_dbm, 1),
      on: on
        ? on.front_end_power_dbm === null
          ? 'none'
          : formatDbm(on.front_end_power_dbm, 1)
        : '--',
    },
    {
      label: <Tooltip label="SNR">Desired power − effective floor.</Tooltip>,
      off: formatDb(off.snr_db, 1),
      on: on ? formatDb(on.snr_db, 1) : '--',
    },
    {
      label: <Tooltip label="SNR margin">SNR − required_SNR.</Tooltip>,
      off: formatDb(off.snr_margin_db, 1),
      on: on ? formatDb(on.snr_margin_db, 1) : '--',
    },
    {
      label: <Tooltip label="C/I in channel">Desired power minus in-channel jammer power. Pad does not move this (it attenuates both equally).</Tooltip>,
      off:
        off.jammer_in_channel_dbm === null
          ? '--'
          : formatDb(off.desired_power_dbm - off.jammer_in_channel_dbm, 1),
      on: on
        ? on.jammer_in_channel_dbm === null
          ? '--'
          : formatDb(on.desired_power_dbm - on.jammer_in_channel_dbm, 1)
        : '--',
    },
  ];

  return (
    <div className="panel">
      <h2>AGC off vs AGC on</h2>
      {on === null ? (
        <div style={{ color: 'var(--fg-dim)' }}>
          No input P1dB on the cascade; AGC-on column skipped. Fill in P1dB to
          see the trade.
        </div>
      ) : (
        <table className="component-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Quantity</th>
              <th style={{ textAlign: 'right' }}>AGC off</th>
              <th style={{ textAlign: 'right' }}>AGC on</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.off}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.on}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
