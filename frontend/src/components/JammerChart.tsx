import { useMemo } from 'react';

import { formatDbm, formatHz } from '../format';
import type { JammerParams } from '../state/jammerStore';
import type { JammerScenario } from '../types';
import { Plot, PLOT_COLORS } from './Plot';

const COLOR_DESIRED = '#22c55e'; // green
const COLOR_NOISE = '#f97316'; // orange
const COLOR_CW = '#f59e0b'; // amber
const COLOR_IM3 = '#ef4444'; // red
const COLOR_FLOOR = '#38bdf8'; // thermal floor
const COLOR_EFF_FLOOR = '#a855f7'; // effective floor (with jammer in channel)
const COLOR_CHANNEL = 'rgba(34, 197, 94, 0.08)';
const COLOR_STOPBAND = 'rgba(148, 163, 184, 0.1)';

/** One Plotly trace entry.  Kept untyped — same approach as Ip3Chart. */
type Trace = Record<string, unknown>;

export function JammerChart({
  scenario,
  params,
}: {
  scenario: JammerScenario;
  params: JammerParams;
}) {
  const { data, layout } = useMemo(() => {
    const centerHz = params.desired_f_hz;
    const bHz = params.bandwidth_hz;

    // Collect every frequency that must fit on the x-axis so the plot
    // frames both the desired channel and anything the jammer puts on it.
    const freqSet: number[] = [centerHz];
    if (params.preselect_passband_min_hz !== null) freqSet.push(params.preselect_passband_min_hz);
    if (params.preselect_passband_max_hz !== null) freqSet.push(params.preselect_passband_max_hz);
    if (params.noise) {
      freqSet.push(
        params.noise.f_center_hz - 0.5 * params.noise.bandwidth_hz,
        params.noise.f_center_hz + 0.5 * params.noise.bandwidth_hz,
      );
    }
    for (const t of scenario.cw_tones) freqSet.push(t.f_hz);
    for (const p of scenario.im3_products) freqSet.push(p.frequency_hz);

    const fMin = Math.min(...freqSet);
    const fMax = Math.max(...freqSet);
    const pad = Math.max((fMax - fMin) * 0.08, bHz * 2);
    const xMin = (fMin - pad) / 1e6;
    const xMax = (fMax + pad) / 1e6;

    // Y range: use the strongest visible power plus a margin at the top,
    // and the thermal floor minus a margin at the bottom.
    const powers: number[] = [
      scenario.thermal_floor_dbm,
      scenario.effective_floor_dbm,
      scenario.desired_power_dbm,
    ];
    if (params.noise) powers.push(params.noise.p_dbm);
    for (const t of scenario.cw_tones) powers.push(t.p_dbm);
    for (const p of scenario.im3_products) powers.push(p.power_dbm);
    const yMax = Math.max(...powers.filter((v) => Number.isFinite(v))) + 10;
    const yMin = Math.min(scenario.thermal_floor_dbm, scenario.effective_floor_dbm) - 15;

    const data: Trace[] = [];

    // --- Floor lines (horizontal) ---
    data.push({
      type: 'scatter',
      mode: 'lines',
      name: 'Thermal floor (kTB + NF)',
      x: [xMin, xMax],
      y: [scenario.thermal_floor_dbm, scenario.thermal_floor_dbm],
      line: { color: COLOR_FLOOR, width: 1.5, dash: 'dot' },
      hovertemplate: `${scenario.thermal_floor_dbm.toFixed(1)} dBm<extra>thermal floor</extra>`,
    });
    if (Math.abs(scenario.effective_floor_dbm - scenario.thermal_floor_dbm) > 0.1) {
      data.push({
        type: 'scatter',
        mode: 'lines',
        name: 'Effective floor (in-channel jammer added)',
        x: [xMin, xMax],
        y: [scenario.effective_floor_dbm, scenario.effective_floor_dbm],
        line: { color: COLOR_EFF_FLOOR, width: 2, dash: 'dash' },
        hovertemplate: `${scenario.effective_floor_dbm.toFixed(1)} dBm<extra>effective floor</extra>`,
      });
    }

    // --- Noise jammer as a rectangle ---
    // The rectangle is drawn at the jammer's power-in-B height so its
    // relation to the floor is visible without visually inflating an
    // off-band jammer.  The total-power label is in the hover text.
    if (params.noise) {
      const n = params.noise;
      const nLo = (n.f_center_hz - 0.5 * n.bandwidth_hz) / 1e6;
      const nHi = (n.f_center_hz + 0.5 * n.bandwidth_hz) / 1e6;
      // Power-spectral-density-in-B height: total minus 10*log10(BW/B).
      const bRatioDb = 10 * Math.log10(n.bandwidth_hz / bHz);
      const barTop = n.p_dbm - Math.max(bRatioDb, 0);
      data.push({
        type: 'scatter',
        mode: 'lines',
        name: `Noise jammer (${formatDbm(n.p_dbm, 1)} in ${formatHz(n.bandwidth_hz)})`,
        x: [nLo, nLo, nHi, nHi],
        y: [yMin, barTop, barTop, yMin],
        fill: 'toself',
        line: { color: COLOR_NOISE, width: 1 },
        fillcolor: 'rgba(249, 115, 22, 0.18)',
        hoveron: 'points+fills',
        hovertemplate:
          `Noise jammer<br>total ${formatDbm(n.p_dbm, 1)} in ${formatHz(n.bandwidth_hz)}<br>` +
          `height = power per receiver bandwidth<extra></extra>`,
      });
    }

    // --- Desired signal as a stem/marker ---
    data.push({
      type: 'scatter',
      mode: 'markers',
      name: 'Desired signal',
      x: [centerHz / 1e6],
      y: [scenario.desired_power_dbm],
      marker: { color: COLOR_DESIRED, size: 11, symbol: 'triangle-up' },
      hovertemplate:
        `Desired: ${formatDbm(scenario.desired_power_dbm, 1)}<br>` +
        `SNR ${scenario.snr_db.toFixed(1)} dB<extra></extra>`,
    });

    // --- CW jammer tones ---
    if (scenario.cw_tones.length) {
      data.push({
        type: 'scatter',
        mode: 'markers',
        name: 'CW jammer tone(s)',
        x: scenario.cw_tones.map((t) => t.f_hz / 1e6),
        y: scenario.cw_tones.map((t) => t.p_dbm),
        marker: { color: COLOR_CW, size: 10, symbol: 'diamond' },
        hovertemplate: '%{x:.3f} MHz<br>%{y:.1f} dBm<extra>CW jammer</extra>',
      });
    }

    // --- IM3 products ---
    if (scenario.im3_products.length) {
      data.push({
        type: 'scatter',
        mode: 'markers',
        name: scenario.im3_valid ? 'IM3 product(s)' : 'IM3 (invalid: above P1dB)',
        x: scenario.im3_products.map((p) => p.frequency_hz / 1e6),
        y: scenario.im3_products.map((p) => p.power_dbm),
        marker: {
          color: COLOR_IM3,
          size: 10,
          symbol: scenario.im3_valid ? 'x' : 'x-open',
          line: { color: COLOR_IM3, width: 2 },
        },
        hovertemplate: '%{x:.3f} MHz<br>%{y:.1f} dBm<extra>IM3</extra>',
      });
    }

    // --- Shapes: preselect stopbands and receiver channel ---
    const shapes: Record<string, unknown>[] = [];

    if (
      params.preselect_passband_min_hz !== null &&
      params.preselect_passband_max_hz !== null
    ) {
      const psLo = params.preselect_passband_min_hz / 1e6;
      const psHi = params.preselect_passband_max_hz / 1e6;
      if (psLo > xMin) {
        shapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: xMin,
          x1: psLo,
          y0: 0,
          y1: 1,
          fillcolor: COLOR_STOPBAND,
          line: { width: 0 },
          layer: 'below',
        });
      }
      if (psHi < xMax) {
        shapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: psHi,
          x1: xMax,
          y0: 0,
          y1: 1,
          fillcolor: COLOR_STOPBAND,
          line: { width: 0 },
          layer: 'below',
        });
      }
    }

    // Receiver channel (centered on desired, width B).
    const channelLo = (centerHz - 0.5 * bHz) / 1e6;
    const channelHi = (centerHz + 0.5 * bHz) / 1e6;
    shapes.push({
      type: 'rect',
      xref: 'x',
      yref: 'paper',
      x0: channelLo,
      x1: channelHi,
      y0: 0,
      y1: 1,
      fillcolor: COLOR_CHANNEL,
      line: { color: 'rgba(34, 197, 94, 0.4)', width: 1, dash: 'dot' },
      layer: 'below',
    });

    const annotations: Record<string, unknown>[] = [
      {
        x: centerHz / 1e6,
        y: yMax,
        text: `channel: ${formatHz(bHz)}`,
        showarrow: false,
        yanchor: 'top',
        xshift: 0,
        yshift: -4,
        font: { color: COLOR_DESIRED, size: 11 },
      },
    ];
    if (
      params.preselect_passband_min_hz !== null &&
      params.preselect_passband_max_hz !== null
    ) {
      annotations.push({
        x: (params.preselect_passband_min_hz + params.preselect_passband_max_hz) / 2e6,
        y: yMax,
        text: `${params.preselect_label} passband`,
        showarrow: false,
        yanchor: 'top',
        yshift: -22,
        font: { color: PLOT_COLORS.fgDim, size: 10 },
      });
    }

    const layout = {
      title: { text: '' },
      height: 460,
      margin: { l: 64, r: 24, t: 36, b: 52 },
      paper_bgcolor: PLOT_COLORS.bg,
      plot_bgcolor: PLOT_COLORS.plotBg,
      font: { color: PLOT_COLORS.fg, size: 12 },
      xaxis: {
        title: { text: 'Frequency (MHz)' },
        range: [xMin, xMax],
        gridcolor: PLOT_COLORS.grid,
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Input-referred power (dBm)' },
        range: [yMin, yMax],
        gridcolor: PLOT_COLORS.grid,
        zeroline: false,
      },
      legend: {
        orientation: 'h',
        y: 1.04,
        yanchor: 'bottom',
        x: 0,
        font: { size: 11 },
      },
      hovermode: 'closest',
      shapes,
      annotations,
    };
    return { data, layout };
  }, [scenario, params]);

  return (
    <Plot
      data={data}
      layout={layout}
      config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
      useResizeHandler
      style={{ width: '100%' }}
    />
  );
}
