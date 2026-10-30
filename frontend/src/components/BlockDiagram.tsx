import { Fragment } from 'react';
import { formatDb, formatDbm, formatHz } from '../format';
import type { CascadeResponse, RfComponent } from '../types';

export function BlockDiagram({
  components,
  result,
}: {
  components: RfComponent[];
  result: CascadeResponse | null;
}) {
  const stageById = new Map(result?.stages.map((s) => [s.id, s]) ?? []);
  return (
    <div className="block-diagram">
      <div className="block endpoint">
        <div className="block-name">Antenna</div>
        <div style={{ fontSize: '0.8em', color: 'var(--fg-dim)' }}>
          {result && result.stages[0]?.frequency_in_hz !== null
            ? formatHz(result.stages[0]?.frequency_in_hz ?? null)
            : 'input'}
        </div>
      </div>
      {components.map((c) => {
        const s = stageById.get(c.id);
        return (
          <Fragment key={c.id}>
            <div className="arrow">→</div>
            <div className="block">
              <div className="block-type">{c.type}</div>
              <div className="block-name">{c.name || c.type}</div>
              {s && (
                <div className="stats">
                  <span className="k">G</span>
                  <span className="v">{formatDb(s.gain_db, 1)}</span>
                  <span className="k">NF</span>
                  <span className="v">{formatDb(s.nf_db, 2)}</span>
                  <span className="k">IIP3</span>
                  <span className="v">{formatDbm(s.iip3_dbm, 1)}</span>
                  <span className="k">ΣG</span>
                  <span className="v">{formatDb(s.cumulative_gain_db, 1)}</span>
                  <span className="k">ΣNF</span>
                  <span className="v">{formatDb(s.cumulative_nf_db, 2)}</span>
                  <span className="k">ΣIIP3</span>
                  <span className="v">{formatDbm(s.cumulative_iip3_dbm, 1)}</span>
                  <span className="k">f_out</span>
                  <span className="v">{formatHz(s.frequency_out_hz)}</span>
                </div>
              )}
            </div>
          </Fragment>
        );
      })}
      <div className="arrow">→</div>
      <div className="block endpoint">
        <div className="block-name">Output</div>
        <div style={{ fontSize: '0.8em', color: 'var(--fg-dim)' }}>
          {result && result.stages.length
            ? formatHz(result.stages[result.stages.length - 1].frequency_out_hz)
            : ''}
        </div>
      </div>
    </div>
  );
}
