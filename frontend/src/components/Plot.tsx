// Single Plotly binding for the app.  Uses the pre-built minified bundle via
// react-plotly.js's factory so the bundler does not need to compile plotly.js.
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

export const Plot = createPlotlyComponent(Plotly);

// Shared dark-theme layout fragments matching index.css variables.
export const PLOT_COLORS = {
  bg: 'rgba(0,0,0,0)',
  plotBg: '#0f172a',
  fg: '#e2e8f0',
  fgDim: '#94a3b8',
  grid: '#334155',
  accent: '#38bdf8',
};
