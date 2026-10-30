import { useState, type ReactNode } from 'react';

import { Tooltip } from './Tooltip';

/**
 * Numeric input that scales between display units and SI, keeps the raw text
 * while the user types, and only commits finite values.
 */
export function NumberField({
  label,
  help,
  value,
  scale = 1,
  unit,
  step = 'any',
  min,
  disabled,
  nullable,
  onChange,
}: {
  label: string;
  help: ReactNode;
  value: number | null;
  scale?: number;
  unit: string;
  step?: string | number;
  min?: number;
  disabled?: boolean;
  nullable?: boolean;
  onChange: (v: number | null) => void;
}) {
  const display = value === null ? '' : String(Number((value / scale).toPrecision(10)));
  const [text, setText] = useState(display);
  // Resync when the committed value changes externally (link mode, reset)
  // without clobbering partially typed input such as "2090." or "-".
  const [prevDisplay, setPrevDisplay] = useState(display);
  if (display !== prevDisplay) {
    setPrevDisplay(display);
    setText(display);
  }
  return (
    <div>
      <label>
        <Tooltip label={label}>{help}</Tooltip>
      </label>
      <input
        type="number"
        step={step}
        min={min}
        disabled={disabled}
        value={text}
        placeholder={nullable ? 'none' : undefined}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t.trim() === '') {
            if (nullable) onChange(null);
            return;
          }
          const v = Number(t);
          if (!Number.isFinite(v)) return;
          if (min !== undefined && v < min) return;
          onChange(v * scale);
        }}
      />
      <div style={{ color: 'var(--fg-dim)', fontSize: '0.8em' }}>{unit}</div>
    </div>
  );
}
