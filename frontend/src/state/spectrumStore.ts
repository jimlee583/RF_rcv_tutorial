// Spectrum analyzer state.  Lives above the tab so switching tabs keeps the
// user's two-tone setup.
//
// "Linked" mode derives the receiver parameters (IIP3, gain, NF, bandwidth,
// temperature, LO) from the cascade tab; unlinking freezes them as editable
// local values.

import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { api } from '../api';
import type {
  CascadeResponse,
  MixerComponent,
  ReceiverConfig,
  SpectrumRequest,
  SpectrumResponse,
} from '../types';

export type SpectrumParams = Omit<SpectrumRequest, 'spur_table'>;

// The worked example from the project spec.
export const SPEC_EXAMPLE: SpectrumParams = {
  f1_hz: 2.09e9,
  f2_hz: 2.11e9,
  p1_dbm: -40,
  p2_dbm: -40,
  lo_hz: 2.0e9,
  sideband: 'lower',
  iip3_dbm: 0,
  iip2_dbm: null,
  gain_db: 0,
  nf_db: 0,
  bandwidth_hz: 1e6,
  temperature_k: 290,
  rbw_hz: null,
  include_mixer_spurs: true,
  mixer_spur_order_max: 3,
  lo_power_dbm: null,
  lo_rf_isolation_db: null,
  lo_if_isolation_db: null,
};

/** Fields that follow the cascade while linked. */
export const LINKED_FIELDS = [
  'lo_hz',
  'sideband',
  'iip3_dbm',
  'gain_db',
  'nf_db',
  'bandwidth_hz',
  'temperature_k',
  'lo_power_dbm',
  'lo_rf_isolation_db',
] as const satisfies readonly (keyof SpectrumParams)[];

export type LinkedField = (typeof LINKED_FIELDS)[number];

interface State {
  params: SpectrumParams;
  linked: boolean;
  result: SpectrumResponse | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_PARAMS'; patch: Partial<SpectrumParams> }
  | { type: 'SET_LINKED'; linked: boolean; snapshot: Partial<SpectrumParams> }
  | { type: 'RESET_TONES' }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; result: SpectrumResponse }
  | { type: 'FETCH_ERROR'; error: string };

const initial: State = {
  params: SPEC_EXAMPLE,
  linked: true,
  result: null,
  loading: false,
  error: null,
};

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
    case 'RESET_TONES':
      return {
        ...state,
        params: {
          ...state.params,
          f1_hz: SPEC_EXAMPLE.f1_hz,
          f2_hz: SPEC_EXAMPLE.f2_hz,
          p1_dbm: SPEC_EXAMPLE.p1_dbm,
          p2_dbm: SPEC_EXAMPLE.p2_dbm,
        },
      };
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, result: action.result };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

/** Receiver-derived values pulled from the cascade tab. */
export function deriveFromCascade(
  config: ReceiverConfig | null,
  result: CascadeResponse | null,
): Partial<Pick<SpectrumParams, LinkedField>> {
  const out: Partial<Pick<SpectrumParams, LinkedField>> = {};
  if (config) {
    out.bandwidth_hz = config.bandwidth_hz;
    out.temperature_k = config.temperature_k;
    const mixer = config.components.find((c): c is MixerComponent => c.type === 'mixer');
    if (mixer) {
      out.lo_hz = mixer.lo_frequency_hz;
      out.sideband = mixer.sideband;
      out.lo_power_dbm = mixer.lo_power_dbm;
      out.lo_rf_isolation_db = mixer.lo_rf_isolation_db;
    }
  }
  if (result) {
    out.gain_db = result.totals.gain_db;
    out.nf_db = result.totals.nf_db;
    if (result.totals.iip3_dbm !== null) out.iip3_dbm = result.totals.iip3_dbm;
  }
  return out;
}

export interface SpectrumStore {
  state: State;
  /** Parameters actually sent to the API (linked fields overlaid). */
  effective: SpectrumParams;
  /** True when the cascade has a mixer to take the LO from. */
  cascadeHasMixer: boolean;
  setParams: (patch: Partial<SpectrumParams>) => void;
  setLinked: (linked: boolean) => void;
  resetTones: () => void;
}

export function useSpectrumStore(
  config: ReceiverConfig | null,
  cascadeResult: CascadeResponse | null,
): SpectrumStore {
  const [state, dispatch] = useReducer(reducer, initial);

  const derived = useMemo(
    () => deriveFromCascade(config, cascadeResult),
    [config, cascadeResult],
  );

  const effective = useMemo<SpectrumParams>(
    () => (state.linked ? { ...state.params, ...derived } : state.params),
    [state.params, state.linked, derived],
  );

  // Debounced fetch whenever the effective request changes.
  useEffect(() => {
    const handle = setTimeout(async () => {
      dispatch({ type: 'FETCH_START' });
      try {
        const result = await api.spectrum({ ...effective, spur_table: null });
        dispatch({ type: 'FETCH_SUCCESS', result });
      } catch (err) {
        dispatch({ type: 'FETCH_ERROR', error: (err as Error).message });
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [effective]);

  const setLinked = useCallback(
    (linked: boolean) => {
      // On unlink, freeze the currently derived values so nothing jumps.
      dispatch({ type: 'SET_LINKED', linked, snapshot: linked ? {} : derived });
    },
    [derived],
  );

  return {
    state,
    effective,
    cascadeHasMixer: derived.lo_hz !== undefined,
    setParams: useCallback((patch) => dispatch({ type: 'SET_PARAMS', patch }), []),
    setLinked,
    resetTones: useCallback(() => dispatch({ type: 'RESET_TONES' }), []),
  };
}
