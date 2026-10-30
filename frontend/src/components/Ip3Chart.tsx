import { useMemo } from 'react';

import { formatDb, formatDbm } from '../format';
import type { Ip3CurveResponse } from '../types';
import { Plot, PLOT_COLORS } from './Plot';

const FUND = '#38bdf8';
const IM3 = '#ef4444';
const NOISE = '#94a3b8';
const VALID = 'rgba(34, 197, 94, 0.08)';
const EXTRAP = 'rgba(239, 68, 68, 0.08)';

function splitAt(
  points: Ip3CurveResponse['points'],
  xCut: number,
  yOf: (p: Ip3CurveResponse['points'][number]) => number,
): { xIn: number[]; yIn: number[]; xOut: number[]; yOut: number[] } {
  const xIn: number[] = [];
  const yIn: number[] = [];
  const xOut: number[] = [];
  const yOut: number[] = [];
  for (const p of points) {
    if (p.pin_dbm <= xCut) {
      xIn.push(p.pin_dbm);
      yIn.push(yOf(p));
    } else {
      xOut.push(p.pin_dbm);
      yOut.push(yOf(p));
    }
  }
  // Join the two segments at the cut so the dashed tail starts on the solid end.
  if (xIn.length && xOut.length) {
    xOut.unshift(xIn[xIn.length - 1]);
    yOut.unshift(yIn[yIn.length - 1]);
  }
  return { xIn, yIn, xOut, yOut };
}

export function Ip3Chart({ result }: { result: Ip3CurveResponse }) {
  const { data, layout } = useMemo(() => {
    const pins = result.points.map((p) => p.pin_dbm);
    const pinMin = pins[0];
    const pinMax = pins[pins.length - 1];
    const xMax = Math.max(pinMax, result.iip3_dbm + 2);
    const xMin = Math.min(pinMin, result.noise_floor_in_dbm - 2);
    const fundAtSfdr = result.pin_at_im3_eq_noise_dbm + result.gain_db;
    const yMin = result.noise_floor_out_dbm - 18;
    const yMax = Math.max(result.oip3_dbm, fundAtSfdr, result.noise_floor_out_dbm) + 14;

    const fund = splitAt(result.points, result.valid_region_max_dbm, (p) => p.fundamental_out_dbm);
    const im3 = splitAt(result.points, result.valid_region_max_dbm, (p) => p.im3_out_dbm);

    const data: unknown[] = [
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Fundamental (1 dB/dB)',
        x: fund.xIn.length ? fund.xIn : fund.xOut,
        y: fund.yIn.length ? fund.yIn : fund.yOut,
        line: { color: FUND, width: 2.4, dash: fund.xIn.length ? 'solid' : 'dash' },
        hovertemplate: 'Pin %{x:.1f} dBm<br>Pfund %{y:.1f} dBm<extra>fundamental</extra>',
        legendgroup: 'fund',
      },
      ...(fund.xIn.length && fund.xOut.length
        ? [
            {
              type: 'scatter',
              mode: 'lines',
              name: 'Fundamental (extrapolated)',
              x: fund.xOut,
              y: fund.yOut,
              line: { color: FUND, width: 2, dash: 'dash' },
              hovertemplate: 'Pin %{x:.1f} dBm<br>Pfund %{y:.1f} dBm<extra>extrapolated</extra>',
              legendgroup: 'fund',
              showlegend: false,
            },
          ]
        : []),
      {
        type: 'scatter',
        mode: 'lines',
        name: 'IM3 (3 dB/dB)',
        x: im3.xIn.length ? im3.xIn : im3.xOut,
        y: im3.yIn.length ? im3.yIn : im3.yOut,
        line: { color: IM3, width: 2.4, dash: im3.xIn.length ? 'solid' : 'dash' },
        hovertemplate: 'Pin %{x:.1f} dBm<br>PIM3 %{y:.1f} dBm<extra>IM3</extra>',
        legendgroup: 'im3',
      },
      ...(im3.xIn.length && im3.xOut.length
        ? [
            {
              type: 'scatter',
              mode: 'lines',
              name: 'IM3 (extrapolated)',
              x: im3.xOut,
              y: im3.yOut,
              line: { color: IM3, width: 2, dash: 'dash' },
              hovertemplate: 'Pin %{x:.1f} dBm<br>PIM3 %{y:.1f} dBm<extra>extrapolated</extra>',
              legendgroup: 'im3',
              showlegend: false,
            },
          ]
        : []),
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Noise floor (output)',
        x: [xMin, xMax],
        y: [result.noise_floor_out_dbm, result.noise_floor_out_dbm],
        line: { color: NOISE, width: 1.4, dash: 'dot' },
        hovertemplate: `${result.noise_floor_out_dbm.toFixed(1)} dBm<extra>noise floor</extra>`,
      },
      {
        type: 'scatter',
        mode: 'markers',
        name: 'IP3 (extrapolated)',
        x: [result.iip3_dbm],
        y: [result.oip3_dbm],
        marker: {
          color: PLOT_COLORS.fg,
          size: 11,
          symbol: 'x',
          line: { color: PLOT_COLORS.fg, width: 2 },
        },
        hovertemplate:
          `IIP3 ${formatDbm(result.iip3_dbm, 1)}<br>OIP3 ${formatDbm(result.oip3_dbm, 1)}<extra>intercept</extra>`,
      },
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: `SFDR ${formatDb(result.sfdr3_db, 1)}`,
        x: [
          result.pin_at_im3_eq_noise_dbm,
          result.pin_at_im3_eq_noise_dbm,
        ],
        y: [result.noise_floor_out_dbm, fundAtSfdr],
        line: { color: '#22c55e', width: 2 },
        marker: { color: '#22c55e', size: 7, symbol: 'line-ew-open' },
        hovertemplate:
          `Pin ${result.pin_at_im3_eq_noise_dbm.toFixed(1)} dBm<br>` +
          `SFDR ${result.sfdr3_db.toFixed(1)} dB<extra></extra>`,
      },
    ];

    const validLabel =
      result.valid_region_source === 'ip1db' ? 'input P1dB' : 'IIP3 − 10 dB';

    const layout = {
      title: { text: '' },
      height: 460,
      margin: { l: 64, r: 24, t: 36, b: 52 },
      paper_bgcolor: PLOT_COLORS.bg,
      plot_bgcolor: PLOT_COLORS.plotBg,
      font: { color: PLOT_COLORS.fg, size: 12 },
      xaxis: {
        title: { text: 'Input power Pin (dBm)' },
        range: [xMin, xMax],
        gridcolor: PLOT_COLORS.grid,
        zeroline: false,
      },
      yaxis: {
        title: { text: 'Output power (dBm)' },
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
      shapes: [
        {
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: xMin,
          x1: result.valid_region_max_dbm,
          y0: 0,
          y1: 1,
          fillcolor: VALID,
          line: { width: 0 },
          layer: 'below',
        },
        {
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: result.valid_region_max_dbm,
          x1: xMax,
          y0: 0,
          y1: 1,
          fillcolor: EXTRAP,
          line: { width: 0 },
          layer: 'below',
        },
        {
          type: 'line',
          xref: 'x',
          yref: 'paper',
          x0: result.valid_region_max_dbm,
          x1: result.valid_region_max_dbm,
          y0: 0,
          y1: 1,
          line: { color: '#f59e0b', width: 1, dash: 'dash' },
        },
        {
          type: 'line',
          xref: 'x',
          yref: 'y',
          x0: result.noise_floor_in_dbm,
          x1: result.pin_at_im3_eq_noise_dbm,
          y0: result.noise_floor_out_dbm,
          y1: result.noise_floor_out_dbm,
          line: { color: '#22c55e', width: 1, dash: 'dot' },
        },
      ],
      annotations: [
        {
          x: result.iip3_dbm,
          y: result.oip3_dbm,
          text: 'IP3 (extrapolated)',
          showarrow: true,
          arrowhead: 2,
          ax: 50,
          ay: -28,
          font: { color: PLOT_COLORS.fg, size: 11 },
          arrowcolor: PLOT_COLORS.fgDim,
        },
        {
          x: result.pin_at_im3_eq_noise_dbm,
          y: (result.noise_floor_out_dbm + fundAtSfdr) / 2,
          text: `SFDR ${result.sfdr3_db.toFixed(1)} dB`,
          showarrow: false,
          xanchor: 'left',
          xshift: 8,
          font: { color: '#22c55e', size: 12 },
        },
        {
          x: result.valid_region_max_dbm,
          y: yMax,
          text: validLabel,
          showarrow: false,
          yanchor: 'top',
          xanchor: 'right',
          xshift: -6,
          yshift: -4,
          font: { color: '#f59e0b', size: 11 },
        },
      ],
    };
    return { data, layout };
  }, [result]);

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
