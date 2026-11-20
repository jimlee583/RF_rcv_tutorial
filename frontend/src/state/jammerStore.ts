// Jammer state.  Lives above the tab so switching tabs keeps the user's
// scenario.  Linked mode overlays cascaded IIP3, NF, bandwidth, temperature,
// input P1dB, and the first filter's passband + stopband rejection.

import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { api } from '../api';
import type {
  CascadeResponse,
  FilterComponent,
  JammerRequest,
  JammerResponse,
  ReceiverConfig,
} from '../types';

export type JammerParams = JammerRequest;

/** Default scenario: in-band noise jammer on top of the lab's default receiver. */
export const DEFAULT_PARAMS: JammerParams = {
  desired_f_hz: 2.10e9,
  desired_p_dbm: -80,
  required_snr_db: 10,
  iip3_dbm: 0,
  nf_db: 5,
  bandwidth_hz: 1_000_000,
  temperature_k: 290,
  input_p1db_dbm: -10,
  agc_backoff_db: 3,
  preselect_passband_min_hz: 2.0e9,
  preselect_passband_max_hz: 2.2e9,
  preselect_stopband_rejection_db: 50,
  preselect_label: 'RF preselect',
  noise: { p_dbm: -85, f_center_hz: 2.10e9, bandwidth_hz: 1_000_000 },
  cw_tones: null,
};

/** Fields that follow the cascade when linked. */
export const LINKED_FIELDS = [
  'iip3_dbm',
  'nf_db',
  'bandwidth_hz',
  'temperature_k',
  'input_p1db_dbm',
  'preselect_passband_min_hz',
  'preselect_passband_max_hz',
  'preselect_stopband_rejection_db',
  'preselect_label',
  'desired_f_hz',
] as const satisfies readonly (keyof JammerParams)[];

export type LinkedField = (typeof LINKED_FIELDS)[number];

export type JammerKind = 'noise' | 'cw';

export type JammerPreset =
  | 'in_band_noise'
  | 'out_of_band_noise'
  | 'im3_on_channel'
  | 'compressing_cw';

interface State {
  params: JammerParams;
  linked: boolean;
  kind: JammerKind;
  agcShown: 'off' | 'on';
  result: JammerResponse | null;
  resultParams: JammerParams | null;
  previousResult: JammerResponse | null;
  previousParams: JammerParams | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_PARAMS'; patch: Partial<JammerParams> }
  | { type: 'SET_LINKED'; linked: boolean; snapshot: Partial<JammerParams> }
  | { type: 'SET_KIND'; kind: JammerKind }
  | { type: 'SET_AGC'; shown: 'off' | 'on' }
  | { type: 'LOAD_PRESET'; preset: JammerPreset }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; result: JammerResponse; params: JammerParams }
  | { type: 'FETCH_ERROR'; error: string };

const initial: State = {
  params: DEFAULT_PARAMS,
  linked: true,
  kind: 'noise',
  agcShown: 'off',
  result: null,
  resultParams: null,
  previousResult: null,
  previousParams: null,
  loading: false,
  error: null,
};

/** Replace the jammer section of `params` with the chosen preset. */
function applyPreset(
  params: JammerParams,
  preset: JammerPreset,
): { params: JammerParams; kind: JammerKind } {
  const f = params.desired_f_hz;
  const b = params.bandwidth_hz;
  switch (preset) {
    case 'in_band_noise':
      return {
        params: {
          ...params,
          noise: { p_dbm: -85, f_center_hz: f, bandwidth_hz: b },
          cw_tones: null,
        },
        kind: 'noise',
      };
    case 'out_of_band_noise':
      // A jammer in the preselect stopband; 400 MHz above center is a safe default.
      return {
        params: {
          ...params,
          noise: { p_dbm: -30, f_center_hz: f + 4e8, bandwidth_hz: b },
          cw_tones: null,
        },
        kind: 'noise',
      };
    case 'im3_on_channel': {
      // Two CW tones inside the preselect but outside B so that
      // 2 f1 - f2 = desired frequency.
      // Space the tones several channel widths apart so their IM3 falls on f.
      const spacing = Math.max(5 * b, 5e6);
      const f1 = f + spacing;
      const f2 = f1 + spacing; // 2 f1 - f2 = f1 - spacing = f
      return {
        params: {
          ...params,
          noise: null,
          cw_tones: [
            { f_hz: f1, p_dbm: -40 },
            { f_hz: f2, p_dbm: -40 },
          ],
        },
        kind: 'cw',
      };
    }
    case 'compressing_cw':
      // A single very strong CW tone well above input P1dB.
      return {
        params: {
          ...params,
          noise: null,
          cw_tones: [{ f_hz: f + 5e6, p_dbm: 0 }],
        },
        kind: 'cw',
      };
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PARAMS':
      return { ...state, params: { ...state.params, ...action.patch } };
    case 'SET_LINKED':
      return {
        ...state,
        linked: action.linked,
        params: { ...state.params, ...action.snapshot },
      };
    case 'SET_KIND':
      return {
        ...state,
        kind: action.kind,
        params: {
          ...state.params,
          // Keep one kind active at a time so the chart stays readable.
          noise: action.kind === 'noise'
            ? state.params.noise ?? {
                p_dbm: -85,
                f_center_hz: state.params.desired_f_hz,
                bandwidth_hz: state.params.bandwidth_hz,
              }
            : null,
          cw_tones: action.kind === 'cw'
            ? state.params.cw_tones ?? [
                { f_hz: state.params.desired_f_hz, p_dbm: -40 },
              ]
            : null,
        },
      };
    case 'SET_AGC':
      return { ...state, agcShown: action.shown };
    case 'LOAD_PRESET': {
      const { params, kind } = applyPreset(state.params, action.preset);
      return { ...state, params, kind };
    }
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        previousResult: state.result,
        previousParams: state.resultParams,
        result: action.result,
        resultParams: action.params,
      };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

export function deriveFromCascade(
  config: ReceiverConfig | null,
  result: CascadeResponse | null,
): Partial<Pick<JammerParams, LinkedField>> {
  const out: Partial<Pick<JammerParams, LinkedField>> = {};
  if (config) {
    out.bandwidth_hz = config.bandwidth_hz;
    out.temperature_k = config.temperature_k;
    if (config.source_frequency_hz !== null) {
      out.desired_f_hz = config.source_frequency_hz;
    }
    // Use the first filter in the chain as the preselect.  Attenuator and
    // amplifier stages don't carry a passband so they're ignored.
    const preselect = config.components.find(
      (c): c is FilterComponent => c.type === 'filter',
    );
    if (preselect) {
      out.preselect_passband_min_hz = preselect.passband_min_hz;
      out.preselect_passband_max_hz = preselect.passband_max_hz;
      out.preselect_stopband_rejection_db = preselect.stopband_rejection_db;
      out.preselect_label = preselect.name || 'Preselect filter';
    }
  }
  if (result) {
    out.nf_db = result.totals.nf_db;
    if (result.totals.iip3_dbm !== null) out.iip3_dbm = result.totals.iip3_dbm;
    out.input_p1db_dbm = result.totals.input_p1db_estimate_dbm;
  }
  return out;
}

export interface JammerStore {
  state: State;
  /** Parameters sent to the API (linked fields overlaid when linked). */
  effective: JammerParams;
  setParams: (patch: Partial<JammerParams>) => void;
  setLinked: (linked: boolean) => void;
  setKind: (kind: JammerKind) => void;
  setAgcShown: (shown: 'off' | 'on') => void;
  loadPreset: (preset: JammerPreset) => void;
}

export function useJammerStore(
  config: ReceiverConfig | null,
  cascadeResult: CascadeResponse | null,
): JammerStore {
  const [state, dispatch] = useReducer(reducer, initial);

  const derived = useMemo(
    () => deriveFromCascade(config, cascadeResult),
    [config, cascadeResult],
  );

  const effective = useMemo<JammerParams>(
    () => (state.linked ? { ...state.params, ...derived } : state.params),
    [state.params, state.linked, derived],
  );

  useEffect(() => {
    // Wait for the cascade before the first linked fetch, so the first
    // readout reflects the real receiver and not the fallback defaults.
    if (state.linked && !cascadeResult) return;
    const handle = setTimeout(async () => {
      dispatch({ type: 'FETCH_START' });
      try {
        const result = await api.jammer(effective);
        dispatch({ type: 'FETCH_SUCCESS', result, params: effective });
      } catch (err) {
        dispatch({ type: 'FETCH_ERROR', error: (err as Error).message });
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [effective, state.linked, cascadeResult]);

  const setLinked = useCallback(
    (linked: boolean) => {
      dispatch({ type: 'SET_LINKED', linked, snapshot: linked ? {} : derived });
    },
    [derived],
  );

  return {
    state,
    effective,
    setParams: useCallback((patch) => dispatch({ type: 'SET_PARAMS', patch }), []),
    setLinked,
    setKind: useCallback((kind) => dispatch({ type: 'SET_KIND', kind }), []),
    setAgcShown: useCallback((shown) => dispatch({ type: 'SET_AGC', shown }), []),
    loadPreset: useCallback(
      (preset) => dispatch({ type: 'LOAD_PRESET', preset }),
      [],
    ),
  };
}
