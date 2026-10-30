// Types that mirror the backend Pydantic schemas.
// Keep in sync with backend/app/schemas.py.

export type ComponentType =
  | 'amplifier'
  | 'lna'
  | 'filter'
  | 'attenuator'
  | 'mixer';

export interface BaseComponent {
  id: string;
  name: string;
  freq_min_hz: number | null;
  freq_max_hz: number | null;
  notes: string;
}

export interface AmplifierComponent extends BaseComponent {
  type: 'amplifier';
  gain_db: number;
  nf_db: number;
  iip3_dbm: number | null;
  oip3_dbm: number | null;
  ip1db_in_dbm: number | null;
  op1db_dbm: number | null;
}

export interface LnaComponent extends BaseComponent {
  type: 'lna';
  gain_db: number;
  nf_db: number;
  iip3_dbm: number | null;
  oip3_dbm: number | null;
  ip1db_in_dbm: number | null;
  op1db_dbm: number | null;
}

export interface FilterComponent extends BaseComponent {
  type: 'filter';
  insertion_loss_db: number;
  passband_min_hz: number | null;
  passband_max_hz: number | null;
  stopband_rejection_db: number | null;
  nf_db: number | null;
}

export interface AttenuatorComponent extends BaseComponent {
  type: 'attenuator';
  attenuation_db: number;
  nf_db: number | null;
}

export interface MixerComponent extends BaseComponent {
  type: 'mixer';
  conversion_gain_db: number;
  nf_db: number;
  iip3_dbm: number | null;
  oip3_dbm: number | null;
  ip1db_in_dbm: number | null;
  op1db_dbm: number | null;
  lo_frequency_hz: number;
  sideband: 'lower' | 'upper';
  lo_power_dbm: number | null;
  lo_rf_isolation_db: number | null;
}

export type RfComponent =
  | AmplifierComponent
  | LnaComponent
  | FilterComponent
  | AttenuatorComponent
  | MixerComponent;

export interface ReceiverConfig {
  name: string;
  description: string;
  components: RfComponent[];
  bandwidth_hz: number;
  temperature_k: number;
  source_frequency_hz: number | null;
  illustrative: boolean;
}

export interface StageResult {
  index: number;
  id: string;
  name: string;
  type: string;
  gain_db: number;
  nf_db: number;
  iip3_dbm: number | null;
  oip3_dbm: number | null;
  cumulative_gain_db: number;
  cumulative_nf_db: number;
  cumulative_iip3_dbm: number | null;
  cumulative_oip3_dbm: number | null;
  frequency_in_hz: number | null;
  frequency_out_hz: number | null;
  nf_contribution_db: number;
}

export interface CascadeTotals {
  gain_db: number;
  nf_db: number;
  iip3_dbm: number | null;
  oip3_dbm: number | null;
  noise_floor_dbm: number;
  sfdr3_db: number | null;
  compression_dr_db: number | null;
  input_p1db_estimate_dbm: number | null;
  input_p1db_limiting_stage_id: string | null;
  mds_dbm: number;
  bandwidth_hz: number;
  temperature_k: number;
}

export interface ApiWarning {
  severity: 'info' | 'warning' | 'error';
  message: string;
  stage_id: string | null;
}

export interface CascadeResponse {
  stages: StageResult[];
  totals: CascadeTotals;
  warnings: ApiWarning[];
}

export type LineCategory =
  | 'desired'
  | 'im3'
  | 'im2'
  | 'lo_harmonic'
  | 'mixer_spur'
  | 'noise_marker';

export interface SpectrumLine {
  frequency_hz: number;
  power_dbm: number;
  category: LineCategory;
  label: string;
  illustrative: boolean;
  in_trace_span: boolean;
}

export interface SpectrumTrace {
  frequencies_hz: number[];
  powers_dbm: number[];
  noise_floor_dbm: number;
  rbw_hz: number;
}

export interface SpectrumSide {
  lines: SpectrumLine[];
  trace: SpectrumTrace;
  noise_floor_dbm: number;
}

export interface SpectrumResponse {
  rf: SpectrumSide;
  if: SpectrumSide;
  noise_floor_dbm: number;
  warnings: ApiWarning[];
}

export interface MixerSpurEntry {
  m: number;
  n: number;
  suppression_dbc: number;
}

export interface SpectrumRequest {
  f1_hz: number;
  f2_hz: number;
  p1_dbm: number;
  p2_dbm: number;
  lo_hz: number;
  sideband: 'lower' | 'upper';
  iip3_dbm: number;
  iip2_dbm: number | null;
  gain_db: number;
  nf_db: number;
  bandwidth_hz: number;
  temperature_k: number;
  rbw_hz: number | null;
  include_mixer_spurs: boolean;
  mixer_spur_order_max: number;
  lo_power_dbm: number | null;
  lo_rf_isolation_db: number | null;
  lo_if_isolation_db: number | null;
  spur_table: MixerSpurEntry[] | null;
}

export interface Ip3CurvePoint {
  pin_dbm: number;
  fundamental_out_dbm: number;
  im3_out_dbm: number;
}

export interface Ip3CurveResponse {
  points: Ip3CurvePoint[];
  iip3_dbm: number;
  oip3_dbm: number;
  noise_floor_in_dbm: number;
  noise_floor_out_dbm: number;
  sfdr3_db: number;
  pin_at_im3_eq_noise_dbm: number;
  valid_region_max_dbm: number;
  valid_region_source: 'ip1db' | 'iip3_minus_10';
  gain_db: number;
}

export interface Ip3CurveRequest {
  iip3_dbm: number;
  gain_db: number;
  nf_db: number;
  bandwidth_hz: number;
  temperature_k: number;
  ip1db_in_dbm: number | null;
  pin_min_dbm: number;
  pin_max_dbm: number | null;
  num_points: number;
}
