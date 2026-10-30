// IP3 / SFDR curve state.  Lives above the tab so switching tabs keeps
// the user's sweep.  Linked mode overlays cascaded IIP3, gain, NF,
// bandwidth, temperature and the estimated input P1dB.

import { useCallback, useEffect, useMemo, useReducer } from 'react';

import { api } from '../api';
import type {
  CascadeResponse,
  Ip3CurveRequest,
  Ip3CurveResponse,
  ReceiverConfig,
} from '../types';

export type Ip3Params = Ip3CurveRequest;

// Textbook case from the project spec: IIP3 = 0 dBm, N ≈ −120 dBm, SFDR = 80 dB.
// Bandwidth is 10**((−120 − kT_dBm/Hz) / 10) at 290 K ≈ 251.19 kHz.
export const SPEC_EXAMPLE: Ip3Params = {
  iip3_dbm: 0,
  gain_db: 0,
  nf_db: 0,
  bandwidth_hz: 10 ** ((-120 - -173.975229) / 10),
  temperature_k: 290,
  ip1db_in_dbm: null,
  pin_min_dbm: -140,
  pin_max_dbm: 10,
  num_points: 201,
};

export const LINKED_FIELDS = [
  'iip3_dbm',
  'gain_db',
  'nf_db',
  'bandwidth_hz',
  'temperature_k',
  'ip1db_in_dbm',
] as const satisfies readonly (keyof Ip3Params)[];

export type LinkedField = (typeof LINKED_FIELDS)[number];

interface State {
  params: Ip3Params;
  linked: boolean;
  result: Ip3CurveResponse | null;
  resultParams: Ip3Params | null;
  previousResult: Ip3CurveResponse | null;
  previousParams: Ip3Params | null;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: 'SET_PARAMS'; patch: Partial<Ip3Params> }
  | { type: 'SET_LINKED'; linked: boolean; snapshot: Partial<Ip3Params> }
  | { type: 'LOAD_SPEC' }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; result: Ip3CurveResponse; params: Ip3Params }
  | { type: 'FETCH_ERROR'; error: string };

const initial: State = {
  params: SPEC_EXAMPLE,
  linked: true,
  result: null,
  resultParams: null,
  previousResult: null,
  previousParams: null,
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
    case 'LOAD_SPEC':
      return { ...state, linked: false, params: SPEC_EXAMPLE };
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
): Partial<Pick<Ip3Params, LinkedField>> {
  const out: Partial<Pick<Ip3Params, LinkedField>> = {};
  if (config) {
    out.bandwidth_hz = config.bandwidth_hz;
    out.temperature_k = config.temperature_k;
  }
  if (result) {
    out.gain_db = result.totals.gain_db;
    out.nf_db = result.totals.nf_db;
    if (result.totals.iip3_dbm !== null) out.iip3_dbm = result.totals.iip3_dbm;
    out.ip1db_in_dbm = result.totals.input_p1db_estimate_dbm;
  }
  return out;
}

export interface Ip3Store {
  state: State;
  effective: Ip3Params;
  setParams: (patch: Partial<Ip3Params>) => void;
  setLinked: (linked: boolean) => void;
  loadSpecExample: () => void;
}

export function useIp3Store(
  config: ReceiverConfig | null,
  cascadeResult: CascadeResponse | null,
): Ip3Store {
  const [state, dispatch] = useReducer(reducer, initial);

  const derived = useMemo(
    () => deriveFromCascade(config, cascadeResult),
    [config, cascadeResult],
  );

  const effective = useMemo<Ip3Params>(
    () => (state.linked ? { ...state.params, ...derived } : state.params),
    [state.params, state.linked, derived],
  );

  useEffect(() => {
    // Wait for the cascade so the first curve is already the linked receiver,
    // not the spec-example fallback (which would otherwise flash a change note).
    if (state.linked && !cascadeResult) return;
    const handle = setTimeout(async () => {
      dispatch({ type: 'FETCH_START' });
      try {
        const result = await api.ip3Curve(effective);
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
    loadSpecExample: useCallback(() => dispatch({ type: 'LOAD_SPEC' }), []),
  };
}
