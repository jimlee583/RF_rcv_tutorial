import type { ApiWarning } from '../types';

export function WarningList({ warnings }: { warnings: ApiWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="warnings">
      {warnings.map((w, i) => (
        <div className={`warn-item ${w.severity}`} key={i}>
          <strong>{w.severity.toUpperCase()}: </strong>
          {w.message}
        </div>
      ))}
    </div>
  );
}
