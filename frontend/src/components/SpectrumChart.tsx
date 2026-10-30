import { useMemo } from 'react';

import { formatDbm, formatHz } from '../format';
import type { LineCategory, SpectrumLine, SpectrumSide } from '../types';
import { Plot, PLOT_COLORS } from './Plot';

// Keep in sync with the --cat-* variables in index.css.
const CATEGORY_COLORS: Record<LineCategory, string> = {
  desired: '#22c55e',
  im3: '#ef4444',
  im2: '#f97316',
  lo_harmonic: '#a855f7',
  mixer_spur: '#eab308',
  noise_marker: '#64748b',
};

const CATEGORY_LABELS: Record<LineCategory, string> = {
  desired: 'Desired signals',
  im3: 'Third-order IM (IM3)',
  im2: 'Second-order IM (IM2)',
  lo_harmonic: 'LO leakage / harmonics',
  mixer_spur: 'Mixer spurs (m·RF ± n·LO)',
  noise_marker: 'Noise',
};

const CATEGORY_ORDER: LineCategory[] = [
  'desired',
  'im3',
  'im2',
  'mixer_spur',
  'lo_harmonic',
  'noise_marker',
];

function shortLabel(line: SpectrumLine): string {
  switch (line.category) {
    case 'desired':
      return line.label.includes('1') ? 'f1' : 'f2';
    case 'im3':
      return line.label.includes('2f1') ? '2f1-f2' : '2f2-f1';
    default:
      return '';
  }
}

export function SpectrumChart({
  title,
  subtitle,
  side,
}: {
  title: string;
  subtitle: string;
  side: SpectrumSide;
}) {
  const { data, layout } = useMemo(() => {
    const xs = side.trace.frequencies_hz.map((f) => f / 1e6);
    const xMin = xs[0];
    const xMax = xs[xs.length - 1];
    const inSpan = side.lines.filter((l) => l.in_trace_span);
    const peak = Math.max(
      side.trace.noise_floor_dbm,
      ...inSpan.map((l) => l.power_dbm),
    );
    const floorBase = Math.min(side.trace.noise_floor_dbm, side.noise_floor_dbm) - 12;
    const yMax = peak + 12;

    const data: unknown[] = [
      {
        type: 'scatter',
        mode: 'lines',
        name: `Analyzer trace (RBW ${formatHz(side.trace.rbw_hz)})`,
        x: xs,
        y: side.trace.powers_dbm,
        line: { color: PLOT_COLORS.accent, width: 1.4 },
        hovertemplate: '%{x:.3f} MHz<br>%{y:.1f} dBm<extra>trace</extra>',
      },
      {
        type: 'scatter',
        mode: 'lines',
        name: 'Receiver noise floor (kTB + NF)',
        x: [xMin, xMax],
        y: [side.noise_floor_dbm, side.noise_floor_dbm],
        line: { color: CATEGORY_COLORS.noise_marker, width: 1, dash: 'dash' },
        hovertemplate: `${side.noise_floor_dbm.toFixed(1)} dBm<extra>noise floor</extra>`,
      },
    ];

    for (const cat of CATEGORY_ORDER) {
      const lines = inSpan.filter((l) => l.category === cat);
      if (!lines.length) continue;
      const color = CATEGORY_COLORS[cat];
      // Stems: null-separated vertical segments from the floor to each line.
      const sx: (number | null)[] = [];
      const sy: (number | null)[] = [];
      for (const l of lines) {
        sx.push(l.frequency_hz / 1e6, l.frequency_hz / 1e6, null);
        sy.push(floorBase, l.power_dbm, null);
      }
      data.push({
        type: 'scatter',
        mode: 'lines',
        x: sx,
        y: sy,
        line: { color, width: 2 },
        opacity: 0.8,
        hoverinfo: 'skip',
        showlegend: false,
        legendgroup: cat,
      });
      data.push({
        type: 'scatter',
        mode: 'markers+text',
        name: CATEGORY_LABELS[cat],
        legendgroup: cat,
        x: lines.map((l) => l.frequency_hz / 1e6),
        y: lines.map((l) => l.power_dbm),
        text: lines.map(shortLabel),
        textposition: 'top center',
        textfont: { color, size: 11 },
        marker: {
          color,
          size: 9,
          symbol: lines.map((l) => (l.illustrative ? 'diamond-open' : 'circle')),
          line: { color, width: 2 },
        },
        customdata: lines.map((l) => [
          l.label,
          formatHz(l.frequency_hz),
          l.illustrative ? ' (illustrative level)' : '',
        ]),
        hovertemplate:
          '<b>%{customdata[0]}</b><br>%{customdata[1]}<br>%{y:.1f} dBm%{customdata[2]}<extra></extra>',
      });
    }

    const layout = {
      title: { text: '' },
      height: 360,
      margin: { l: 56, r: 16, t: 24, b: 44 },
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
        title: { text: 'Power (dBm)' },
        range: [floorBase, yMax],
        gridcolor: PLOT_COLORS.grid,
        zeroline: false,
      },
      legend: {
        orientation: 'h',
        y: 1.02,
        yanchor: 'bottom',
        x: 0,
        font: { size: 11 },
      },
      hovermode: 'closest',
      showlegend: true,
    };
    return { data, layout };
  }, [side]);

  return (
    <div>
      <h3 style={{ marginBottom: 0 }}>{title}</h3>
      <div style={{ color: 'var(--fg-dim)', fontSize: '0.8em', marginBottom: 4 }}>{subtitle}</div>
      <Plot
        data={data}
        layout={layout}
        config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
        useResizeHandler
        style={{ width: '100%' }}
      />
    </div>
  );
}

export function SpectrumLineTable({ side }: { side: SpectrumSide }) {
  return (
    <table className="components spectrum-lines">
      <thead>
        <tr>
          <th>Frequency</th>
          <th>Power</th>
          <th>Type</th>
          <th>Product</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {side.lines.map((l, i) => (
          <tr key={i} className={l.in_trace_span ? '' : 'off-span'}>
            <td>{formatHz(l.frequency_hz)}</td>
            <td>{formatDbm(l.power_dbm, 1)}</td>
            <td>
              <span className="swatch" style={{ background: CATEGORY_COLORS[l.category] }} />
              {CATEGORY_LABELS[l.category]}
            </td>
            <td>{l.label}</td>
            <td>
              {l.illustrative && <span className="chip illustrative">illustrative</span>}
              {!l.in_trace_span && <span className="chip offspan">off-span</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
