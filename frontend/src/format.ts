// Formatting helpers shared across tabs.

export function formatHz(hz: number | null | undefined): string {
  if (hz === null || hz === undefined || !Number.isFinite(hz)) return '--';
  const abs = Math.abs(hz);
  if (abs >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (abs >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (abs >= 1e3) return `${(hz / 1e3).toFixed(3)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

export function formatDb(
  db: number | null | undefined,
  digits: number = 2,
): string {
  if (db === null || db === undefined || !Number.isFinite(db)) return '--';
  return `${db.toFixed(digits)} dB`;
}

export function formatDbm(
  dbm: number | null | undefined,
  digits: number = 2,
): string {
  if (dbm === null || dbm === undefined || !Number.isFinite(dbm)) return '--';
  return `${dbm.toFixed(digits)} dBm`;
}

export function parseHz(text: string): number | null {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '') return null;
  const match = trimmed.match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)\s*(ghz|mhz|khz|hz)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2] ?? 'hz';
  const scale = unit === 'ghz' ? 1e9 : unit === 'mhz' ? 1e6 : unit === 'khz' ? 1e3 : 1;
  return value * scale;
}
