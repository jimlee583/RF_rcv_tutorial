import type { ReactNode } from 'react';

export function Tooltip({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="tooltip" tabIndex={0}>
      {label}
      <span className="tooltip-body">{children}</span>
    </span>
  );
}
