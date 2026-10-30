import { formatDb, formatDbm } from '../format';
import type { CascadeTotals } from '../types';
import { Tooltip } from './Tooltip';

export function SummaryStrip({
  totals,
  loading,
}: {
  totals: CascadeTotals | null;
  loading: boolean;
}) {
  if (!totals) {
    return (
      <div className="summary-strip">
        <div className="metric">
          <div className="label">status</div>
          <div className="value">{loading ? 'Analyzing...' : 'Loading'}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="summary-strip">
      <Metric label={<Tooltip label="Gain">Sum of each stage's power gain in dB.</Tooltip>} value={formatDb(totals.gain_db)} />
      <Metric label={<Tooltip label="Noise figure">Cascaded noise figure from Friis' equation, dominated by the first few stages.</Tooltip>} value={formatDb(totals.nf_db)} />
      <Metric label={<Tooltip label="Input IP3">Cascaded input-referred third-order intercept.  Smaller IIP3 means earlier compression of IM3 relative to the fundamental.</Tooltip>} value={formatDbm(totals.iip3_dbm)} />
      <Metric label={<Tooltip label="Output IP3">OIP3 = IIP3 + total gain.</Tooltip>} value={formatDbm(totals.oip3_dbm)} />
      <Metric label={<Tooltip label="Noise floor">kTB + NF.  Input-referred thermal noise power in the receiver bandwidth.</Tooltip>} value={formatDbm(totals.noise_floor_dbm)} />
      <Metric label={<Tooltip label="SFDR">(2/3) * (IIP3 - noise floor).  Two-tone small-signal spurious-free dynamic range.</Tooltip>} value={totals.sfdr3_db === null ? '--' : formatDb(totals.sfdr3_db)} />
      <Metric label={<Tooltip label="Est. input P1dB">Estimated input-referred 1 dB compression point: minimum over stages of (OP1dB - cumulative gain).  Not a sum.</Tooltip>} value={formatDbm(totals.input_p1db_estimate_dbm)} />
      <Metric label="Loading" value={loading ? 'yes' : 'no'} />
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
