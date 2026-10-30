// Receiver store with useReducer.
// Immutable updates; actions cover add / remove / move / edit / replace all.

import { useCallback, useEffect, useReducer } from 'react';

import { api } from '../api';
import type { CascadeResponse, ReceiverConfig, RfComponent } from '../types';

interface State {
  config: ReceiverConfig | null;
  defaults: ReceiverConfig | null;
  templates: Record<string, RfComponent> | null;
  result: CascadeResponse | null;
  previousResult: CascadeResponse | null;
  loading: boolean;
  error: string | null;
  lastAction: string;
}

type Action =
  | { type: 'SET_DEFAULTS'; defaults: ReceiverConfig; templates: Record<string, RfComponent> }
  | { type: 'SET_CONFIG'; config: ReceiverConfig; actionLabel: string }
  | { type: 'UPDATE_COMPONENT'; id: string; patch: Partial<RfComponent> }
  | { type: 'ADD_COMPONENT'; component: RfComponent }
  | { type: 'REMOVE_COMPONENT'; id: string }
  | { type: 'MOVE_COMPONENT'; id: string; direction: 'up' | 'down' }
  | { type: 'SET_META'; patch: Partial<Pick<ReceiverConfig, 'name' | 'description' | 'bandwidth_hz' | 'temperature_k' | 'source_frequency_hz'>>; actionLabel: string }
  | { type: 'ANALYZE_START' }
  | { type: 'ANALYZE_SUCCESS'; result: CascadeResponse }
  | { type: 'ANALYZE_ERROR'; error: string };

const initial: State = {
  config: null,
  defaults: null,
  templates: null,
  result: null,
  previousResult: null,
  loading: false,
  error: null,
  lastAction: '',
};

function moveInArray<T>(arr: T[], idx: number, direction: 'up' | 'down'): T[] {
  const next = arr.slice();
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= arr.length) return next;
  const tmp = next[idx];
  next[idx] = next[target];
  next[target] = tmp;
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_DEFAULTS':
      return {
        ...state,
        defaults: action.defaults,
        templates: action.templates,
        config: state.config ?? action.defaults,
        lastAction: 'Loaded defaults',
      };
    case 'SET_CONFIG':
      return { ...state, config: action.config, lastAction: action.actionLabel };
    case 'UPDATE_COMPONENT': {
      if (!state.config) return state;
      const components = state.config.components.map((c) =>
        c.id === action.id ? ({ ...c, ...action.patch } as RfComponent) : c,
      );
      const name =
        state.config.components.find((c) => c.id === action.id)?.name || action.id;
      return {
        ...state,
        config: { ...state.config, components },
        lastAction: `Edited ${name}`,
      };
    }
    case 'ADD_COMPONENT': {
      if (!state.config) return state;
      return {
        ...state,
        config: {
          ...state.config,
          components: [...state.config.components, action.component],
        },
        lastAction: `Added ${action.component.name || action.component.type}`,
      };
    }
    case 'REMOVE_COMPONENT': {
      if (!state.config) return state;
      const removed = state.config.components.find((c) => c.id === action.id);
      return {
        ...state,
        config: {
          ...state.config,
          components: state.config.components.filter((c) => c.id !== action.id),
        },
        lastAction: `Removed ${removed?.name || action.id}`,
      };
    }
    case 'MOVE_COMPONENT': {
      if (!state.config) return state;
      const idx = state.config.components.findIndex((c) => c.id === action.id);
      if (idx < 0) return state;
      return {
        ...state,
        config: {
          ...state.config,
          components: moveInArray(state.config.components, idx, action.direction),
        },
        lastAction: `Moved ${state.config.components[idx].name || action.id} ${action.direction}`,
      };
    }
    case 'SET_META':
      if (!state.config) return state;
      return {
        ...state,
        config: { ...state.config, ...action.patch },
        lastAction: action.actionLabel,
      };
    case 'ANALYZE_START':
      return { ...state, loading: true, error: null };
    case 'ANALYZE_SUCCESS':
      return {
        ...state,
        loading: false,
        previousResult: state.result,
        result: action.result,
      };
    case 'ANALYZE_ERROR':
      return { ...state, loading: false, error: action.error };
    default:
      return state;
  }
}

export interface ReceiverStore {
  state: State;
  loadDefaults: () => Promise<void>;
  reset: () => void;
  setConfig: (config: ReceiverConfig, label?: string) => void;
  updateComponent: (id: string, patch: Partial<RfComponent>) => void;
  addComponent: (component: RfComponent) => void;
  removeComponent: (id: string) => void;
  moveComponent: (id: string, direction: 'up' | 'down') => void;
  setMeta: (
    patch: Partial<
      Pick<
        ReceiverConfig,
        'name' | 'description' | 'bandwidth_hz' | 'temperature_k' | 'source_frequency_hz'
      >
    >,
    label: string,
  ) => void;
}

export function useReceiverStore(): ReceiverStore {
  const [state, dispatch] = useReducer(reducer, initial);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [defaults, templates] = await Promise.all([
          api.defaults(),
          api.componentTemplates(),
        ]);
        if (cancelled) return;
        dispatch({ type: 'SET_DEFAULTS', defaults, templates });
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: 'ANALYZE_ERROR',
          error: `Failed to load defaults: ${(err as Error).message}`,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced analyze whenever the config changes.
  useEffect(() => {
    if (!state.config) return;
    const handle = setTimeout(async () => {
      dispatch({ type: 'ANALYZE_START' });
      try {
        const config = state.config as ReceiverConfig;
        const result = await api.analyzeCascade({
          components: config.components,
          bandwidth_hz: config.bandwidth_hz,
          temperature_k: config.temperature_k,
          source_frequency_hz: config.source_frequency_hz,
        });
        dispatch({ type: 'ANALYZE_SUCCESS', result });
      } catch (err) {
        dispatch({ type: 'ANALYZE_ERROR', error: (err as Error).message });
      }
    }, 150);
    return () => clearTimeout(handle);
  }, [state.config]);

  const loadDefaults = useCallback(async () => {
    const [defaults, templates] = await Promise.all([
      api.defaults(),
      api.componentTemplates(),
    ]);
    dispatch({ type: 'SET_DEFAULTS', defaults, templates });
    dispatch({ type: 'SET_CONFIG', config: defaults, actionLabel: 'Reset to defaults' });
  }, []);

  const reset = useCallback(() => {
    if (state.defaults) {
      dispatch({
        type: 'SET_CONFIG',
        config: state.defaults,
        actionLabel: 'Reset to defaults',
      });
    }
  }, [state.defaults]);

  return {
    state,
    loadDefaults,
    reset,
    setConfig: useCallback(
      (config, label = 'Loaded configuration') =>
        dispatch({ type: 'SET_CONFIG', config, actionLabel: label }),
      [],
    ),
    updateComponent: useCallback(
      (id, patch) => dispatch({ type: 'UPDATE_COMPONENT', id, patch }),
      [],
    ),
    addComponent: useCallback(
      (component) => dispatch({ type: 'ADD_COMPONENT', component }),
      [],
    ),
    removeComponent: useCallback(
      (id) => dispatch({ type: 'REMOVE_COMPONENT', id }),
      [],
    ),
    moveComponent: useCallback(
      (id, direction) => dispatch({ type: 'MOVE_COMPONENT', id, direction }),
      [],
    ),
    setMeta: useCallback((patch, label) => dispatch({ type: 'SET_META', patch, actionLabel: label }), []),
  };
}
