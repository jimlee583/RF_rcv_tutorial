// Short "why the numbers moved" notes for the change strip.
// Deltas below 0.05 dB are treated as unchanged so rounding noise is ignored.

import type { CascadeResponse, Ip3CurveRequest, Ip3CurveResponse } from './types';

const EPS = 0.05;

function signed(delta: number, digits = 1): string {
  const n = delta.toFixed(digits);
  return delta > 0 ? `+${n}` : n;
}

export function explainIp3Change(
  prev: Ip3CurveResponse | null,
  next: Ip3CurveResponse | null,
  prevParams: Ip3CurveRequest | null,
  nextParams: Ip3CurveRequest | null,
): string | null {
  if (!prev || !next || !nextParams) return null;
  const bits: string[] = [];
  const dIip3 = next.iip3_dbm - prev.iip3_dbm;
  const dG = next.gain_db - prev.gain_db;
  const dNf = nextParams.nf_db - (prevParams?.nf_db ?? nextParams.nf_db);
  const dN = next.noise_floor_in_dbm - prev.noise_floor_in_dbm;
  const dSfdr = next.sfdr3_db - prev.sfdr3_db;

  if (Math.abs(dIip3) >= EPS) {
    bits.push(
      `IIP3 ${signed(dIip3)} dB ${dIip3 > 0 ? 'raises' : 'lowers'} the intercept. ` +
        `IM3 at a given Pin moves ${signed(-2 * dIip3)} dB (two-tone, 2× the IIP3 change).`,
    );
  }

  if (Math.abs(dNf) >= EPS && Math.abs(dN - dNf) < EPS) {
    bits.push(`NF ${signed(dNf)} dB moves the noise floor by the same amount.`);
  } else if (Math.abs(dN) >= EPS) {
    bits.push(`The input noise floor moved ${signed(dN)} dB (N = kTB + NF).`);
  }

  if (Math.abs(dG) >= EPS) {
    bits.push(
      `Gain ${signed(dG)} dB slides both curves and OIP3 by ${signed(dG)} dB. ` +
        `SFDR is input-referred, so gain alone does not change it.`,
    );
  }

  if (Math.abs(dSfdr) >= EPS) {
    bits.push(`Net SFDR ${signed(dSfdr)} dB, from (2/3)(IIP3 − N).`);
  }

  if (prev.valid_region_source !== next.valid_region_source) {
    bits.push(
      next.valid_region_source === 'ip1db'
        ? `The solid-line region now ends at the supplied input P1dB (${next.valid_region_max_dbm.toFixed(1)} dBm) instead of the IIP3 − 10 dB rule of thumb.`
        : `No input P1dB is set, so the solid-line region ends at IIP3 − 10 dB (${next.valid_region_max_dbm.toFixed(1)} dBm).`,
    );
  } else if (Math.abs(next.valid_region_max_dbm - prev.valid_region_max_dbm) >= EPS) {
    bits.push(
      `The upper edge of the trustworthy region moved to ${next.valid_region_max_dbm.toFixed(1)} dBm.`,
    );
  }

  if (!bits.length) return null;
  return bits.join(' ');
}

export function explainCascadeChange(
  lastAction: string,
  prev: CascadeResponse | null,
  next: CascadeResponse | null,
): string | null {
  if (!prev || !next) return null;
  const bits: string[] = [];
  const dGain = next.totals.gain_db - prev.totals.gain_db;
  const dNf = next.totals.nf_db - prev.totals.nf_db;
  const dIip3 =
    next.totals.iip3_dbm !== null && prev.totals.iip3_dbm !== null
      ? next.totals.iip3_dbm - prev.totals.iip3_dbm
      : null;
  const dN = next.totals.noise_floor_dbm - prev.totals.noise_floor_dbm;
  const dSfdr =
    next.totals.sfdr3_db !== null && prev.totals.sfdr3_db !== null
      ? next.totals.sfdr3_db - prev.totals.sfdr3_db
      : null;

  if (Math.abs(dGain) >= EPS) {
    bits.push(`Cascaded gain ${signed(dGain)} dB (sum of stage power gains).`);
  }
  if (Math.abs(dNf) >= EPS) {
    bits.push(
      `Cascaded NF ${signed(dNf)} dB. Friis weights early-stage NF most; later stages are divided by preceding gain.`,
    );
  }
  if (dIip3 !== null && Math.abs(dIip3) >= EPS) {
    bits.push(
      `Cascaded IIP3 ${signed(dIip3)} dB. Each stage's IIP3 is referred to the input through the gain in front of it; the weakest (referred) stage sets the cascade.`,
    );
  }
  if (Math.abs(dN) >= EPS) {
    bits.push(`Noise floor ${signed(dN)} dB (kTB + NF).`);
  }
  if (dSfdr !== null && Math.abs(dSfdr) >= EPS) {
    bits.push(`SFDR ${signed(dSfdr)} dB = (2/3)(IIP3 − N).`);
  }

  if (!bits.length && !lastAction) return null;
  if (!bits.length) return lastAction || null;
  return lastAction ? `${lastAction}. ${bits.join(' ')}` : bits.join(' ');
}
