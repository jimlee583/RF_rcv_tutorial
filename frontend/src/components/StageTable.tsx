import { formatDb, formatDbm, formatHz } from '../format';
import type { CascadeResponse } from '../types';

export function StageTable({ result }: { result: CascadeResponse | null }) {
  if (!result) return null;
  return (
    <table className="components" style={{ marginTop: 4 }}>
      <thead>
        <tr>
          <th>#</th>
          <th>Stage</th>
          <th>Gain</th>
          <th>NF</th>
          <th>IIP3</th>
          <th>OIP3</th>
          <th>ΣGain</th>
          <th>ΣNF</th>
          <th>NF contrib.</th>
          <th>ΣIIP3</th>
          <th>ΣOIP3</th>
          <th>f in → out</th>
        </tr>
      </thead>
      <tbody>
        {result.stages.map((s) => (
          <tr key={s.id}>
            <td>{s.index + 1}</td>
            <td>
              <strong>{s.name}</strong>
              <div style={{ color: 'var(--fg-dim)', fontSize: '0.8em' }}>{s.type}</div>
            </td>
            <td>{formatDb(s.gain_db, 1)}</td>
            <td>{formatDb(s.nf_db)}</td>
            <td>{formatDbm(s.iip3_dbm, 1)}</td>
            <td>{formatDbm(s.oip3_dbm, 1)}</td>
            <td>{formatDb(s.cumulative_gain_db, 1)}</td>
            <td>{formatDb(s.cumulative_nf_db)}</td>
            <td>{formatDb(s.nf_contribution_db)}</td>
            <td>{formatDbm(s.cumulative_iip3_dbm, 1)}</td>
            <td>{formatDbm(s.cumulative_oip3_dbm, 1)}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {formatHz(s.frequency_in_hz)} → {formatHz(s.frequency_out_hz)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
