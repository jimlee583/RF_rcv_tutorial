import type {
  CascadeResponse,
  Ip3CurveRequest,
  Ip3CurveResponse,
  ReceiverConfig,
  RfComponent,
  SpectrumRequest,
  SpectrumResponse,
} from './types';

const BASE = '/api';

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => jsonFetch<{ status: string; version: string }>(`${BASE}/health`),

  defaults: () => jsonFetch<ReceiverConfig>(`${BASE}/defaults`),

  componentTemplates: () =>
    jsonFetch<Record<string, RfComponent>>(`${BASE}/component-templates`),

  analyzeCascade: (payload: {
    components: RfComponent[];
    bandwidth_hz: number;
    temperature_k: number;
    source_frequency_hz: number | null;
  }) =>
    jsonFetch<CascadeResponse>(`${BASE}/cascade/analyze`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  spectrum: (req: SpectrumRequest) =>
    jsonFetch<SpectrumResponse>(`${BASE}/spectrum`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  ip3Curve: (req: Ip3CurveRequest) =>
    jsonFetch<Ip3CurveResponse>(`${BASE}/ip3-curve`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
};
