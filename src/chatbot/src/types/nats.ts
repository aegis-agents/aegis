export enum NatsSubject {
  GetUserAssets = "helper_ingress.user.get_assets",
  GetInstruments = "helper_ingress.instrument.get_instruments",
  GetUserPositions = "helper_ingress.user.get_positions",
  GetUserStrategy = "helper_ingress.user.get_strategy",
  GetUser = "helper_ingress.user.get_user",
  UpdateUserStrategy = "helper_ingress.user.update_strategy",
  Notification = "helper_egress.position_changed.*",
  Withdraw = "helper_ingress.user.withdraw",
  GetUserPositionChartData = "helper_ingress.user.get_position_verbose_time_data",
  GetGlobalInfo = "helper_ingress.global.global_info",
  GetHotInstruments = "helper_ingress.instrument.hot_instruments",
  GetInstrument = "helper_ingress.instrument.get_instrument",
}
export interface HelperGetUserAssetsRequest {
  req_id: string;
  uid: string;
  force_update?: boolean;
}

export interface HelperResponse {
  req_id?: string;
  error?: string;
}

export interface UserAsset {
  chain_id: string;
  token_address: string;
  whitelisted: boolean;
  symbol: string;
  decimals: number;
  balance: string;
  price: string;
  value_usd: string;
}

export interface Portfolio {
  uid: string;
  user_address: string;
  user_address_portfolio: Record<string, UserAsset>;
  smart_address: string;
  smart_address_portfolio: Record<string, UserAsset>;
  smart_address_portfolio_value_usd: string;
  smart_address_position: Position[];
  smart_address_position_value_usd: string;
  smart_address_total_value_usd: string;
  base_token_price: string;
  update_at: number;
}

export interface HelperGetUserAssetsResponse extends HelperResponse {
  portfolio: Portfolio;
}

export interface HelperGetInstrumentsRequest {
  req_id: string;
  chain_ids?: string[];
  instrument_ids?: string[];
  protocol_name?: string;
  underlying_assets?: string[];
  with_data?: boolean;
}

export interface HelperGetInstrumentData {
  hourly_timestamp: number;
  apy: string;
  supply_amount: string;
  supply_amount_usd: string;
  borrow_amount: string;
  utilization: string;
}

export interface HelperGetInstrument {
  instrument_id: string;
  chain_id: string;
  protocol_name: string;
  strategy_type: string;
  underlying_asset: string;
  symbol: string;
  curator: string;
  is_erc4626: boolean;
  erc4626_vault_address: string;
  pool_address: string;
  update_at: number;
  instrument_data?: HelperGetInstrumentData[];
}

export interface HelperGetInstrumentsResponse extends HelperResponse {
  instruments: HelperGetInstrument[];
}

export interface HelperGetUserPositionsRequest {
  req_id: string;
  uid: string;
  with_relative_instruments?: boolean;
}

export interface PositionMeta {
  id: number;
  chain_id: string;
  instrument_id: number;
  instrument_type: string;
  smart_address: string;
  asset: string;
  active: boolean;
}

export interface PositionData {
  chain_id: string;
  instrument_id: number;
  instrument_type: string;
  daily_timestamp: number;
  hourly_timestamp: number;
  smart_address: string;
  asset: string;
  asset_amount: string; // TODO: add decimals
  asset_amount_usd: string;
  shares: string;
  pnl_usd: string;
  roe_usd: string;
  timestamp: number;
}

export interface Position {
  position_meta: PositionMeta;
  position_data: PositionData;
}

export interface HelperGetUserPositionsResponse extends HelperResponse {
  positions: Position[];
  instruments?: HelperGetInstrument[];
}

export interface HelperGetUserStrategyRequest {
  req_id: string;
  uid: string;
}

export interface Mandate {
  uid: string;
  current_strategy: string;
  next_strategy: string;
}

export interface HelperGetUserStrategyResponse extends HelperResponse {
  mandate: Mandate;
}

export interface HelperGetUserRequest {
  req_id: string;
  uid: string;
}

export interface AegisUser {
  uid: string;
  user_address: string;
  agent_address: string;
  smart_address: string;
}

export interface HelperGetUserResponse extends HelperResponse {
  aegis_user: AegisUser;
}

export interface HelperUpdateUserStrategyRequest {
  req_id: string;
  uid: string;
  // 0 - disable, 1 - conservative, 2 - balanced (not supported), 3 - aggressive (not supported)
  strategy: string;
  // true - immediately schedule strategy (not supported now), default false
  immediately_scheduling?: boolean;
  signature: string;
}

export interface HelperUpdateUserStrategyResponse extends HelperResponse {
  changed: boolean;
  mandate: Mandate;
}

export interface HelperEgressPositionChanged {
  req_id: string;
  uid: string;
  transaction_type: string;
  transaction_hash: string;
  explorer_uri: string;
  instrument_of_transaction: PositionMeta;
  user_positions_left?: Position[];
  timestamp: number;
}

export interface HelperUserWithdrawRequest {
  req_id: string;
  chain_id: string;
  uid: string;
  token_address: string;
  token_amount: string;
  nonce: string;
  signature: string;
}

export interface HelperUserWithdrawResponse extends HelperResponse {
  transaction_hash?: string;
  actual_withdraw_amount?: string;
}

interface InstrumentMeta {
  chain_id: string;
  strategy_type: string;
  protocol_name: string;
  instrument_type: string;
  instrument_name: string;
  pool_address: string;
  is_erc4626: boolean;
  erc4626_vault_address: string;
  underlying_asset: string;
  symbol: string;
  curator: string;
}

interface InstrumentData {
  chain_id: string;
  instrument_id: number;
  daily_timestamp: number;
  hourly_timestamp: number;
  apy: string;
  daily_apy: string;
  weekly_apy: string;
  monthly_apy: string;
  supply_amount: string;
  supply_amount_usd: string;
  borrow_amount: string;
  utilization: string;
  timestamp: number;
}

export interface HelperGetUserPositionVerboseTimeDataRequest {
  req_id: string;
  uid: string;
  instrument_id: number;
  days_of_verbose_data?: number;
}

export interface HelperGetUserPositionVerboseTimeDataResponse extends HelperResponse {
  instrument_meta: InstrumentMeta;
  instrument_data: InstrumentData;
  position_meta: PositionMeta;
  // Key is a stringified int64 timestamp: seconds
  verbose_time_position_data: Record<string, PositionData>;
}

// Request type
export interface HelperGetGlobalInfoRequest {
  req_id: string;
  days_of_verbose_data?: number;
}

// GlobalInfo definition
interface GlobalInfo {
  id: string; // MongoDB ObjectId as string
  tvl_usd: number;
  user_count: number;
  conservative_apy: string;
  balanced_apy: string;
  aggressive_apy: string;
  hourly_timestamp: number; // int64 in Go, number in JS
}

// Response structure
export interface HelperGetGlobalInfoResponse extends HelperResponse {
  // Key is a stringified int64 timestamp (all JS object keys are strings)
  global_infos: Record<string, GlobalInfo>;
}

// Request type
export interface HelperHotInstrumentsRequest {
  req_id: string;
  days_of_verbose_data?: number;
}
interface InstrumentData {
  chain_id: string;
  instrument_id: number;
  daily_timestamp: number;
  hourly_timestamp: number;
  apy: string;
  daily_apy: string;
  weekly_apy: string;
  monthly_apy: string;
  supply_amount: string;
  supply_amount_usd: string;
  borrow_amount: string;
  utilization: string;
  timestamp: number;
}

// HelperVerboseInstrument definition
interface HelperVerboseInstrument {
  instrument_id: number;
  chain_id: string;
  protocol_name: string;
  strategy_type: string;
  underlying_asset: string;
  symbol: string;
  curator: string;
  is_erc4626: boolean;
  erc4626_vault_address: string;
  pool_address: string;
  // Key is a stringified int64 timestamp (object keys are strings in JS)
  verbose_instrument_data: Record<string, InstrumentData>;
}

// Response structure
export interface HelperHotInstrumentResponse extends HelperResponse {
  conservative_hot_instruments: HelperVerboseInstrument[];
  balanced_hot_instruments: HelperVerboseInstrument[];
  aggressive_hot_instruments: HelperVerboseInstrument[];
}

export interface HelperGetInstrumentRequest {
  req_id: string;
  instrument_id: number;
  days_of_verbose_data?: number;
}

// InstrumentData definition
interface InstrumentData {
  chain_id: string;
  instrument_id: number;
  daily_timestamp: number;
  hourly_timestamp: number;
  apy: string;
  daily_apy: string;
  weekly_apy: string;
  monthly_apy: string;
  supply_amount: string;
  supply_amount_usd: string;
  borrow_amount: string;
  utilization: string;
  timestamp: number;
}

// HelperVerboseInstrument definition
interface HelperVerboseInstrument {
  instrument_id: number;
  chain_id: string;
  protocol_name: string;
  strategy_type: string;
  underlying_asset: string;
  symbol: string;
  curator: string;
  is_erc4626: boolean;
  erc4626_vault_address: string;
  pool_address: string;
  verbose_instrument_data: Record<string, InstrumentData>;
}

// Response structure
export interface HelperGetInstrumentResponse extends HelperResponse {
  instrument: HelperVerboseInstrument;
}
