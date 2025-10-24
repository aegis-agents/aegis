from pydantic import BaseModel


class AegisUserModel(BaseModel):
    uid: str
    user_address: str
    agent_address: str
    smart_address: str


class MandateModel(BaseModel):
    uid: str
    current_strategy: str
    next_strategy: str


class PositionMetaModel(BaseModel):
    ID: int
    chain_id: str
    instrument_id: int
    instrument_type: str
    smart_address: str
    asset: str


class PositionDataModel(BaseModel):
    chain_id: str
    instrument_id: int
    instrument_type: str
    daily_timestamp: int
    hourly_timestamp: int
    smart_address: str
    asset: str
    asset_amount: str
    asset_amount_usd: str
    shares: str
    pnl_usd: str
    roe_usd: str
    timestamp: int


class InstrumentMetaModel(BaseModel):
    chain_id: str
    strategy_type: str
    protocol_name: str
    instrument_type: str
    instrument_name: str
    pool_address: str
    is_erc4626: bool
    erc4626_vault_address: str
    underlying_asset: str
    curator: str


class TokenMetaModel(BaseModel):
    chain_id: str
    address: str
    symbol: str
    name: str
    decimals: int


class AutoTransactionModel(BaseModel):
    chain_id: str
    block_number: int
    log_id: str
    tx_hash: str
    tx_time: int
    uid: str
    agent_address: str
    smart_address: str
    token0_address: str
    token0_volume: str
    token1_address: str
    token1_volume: str
    instrument_id: int
    type: str
    sub_type: str


class InvestmentExpertSelectedModel(BaseModel):
    selected_conservative_instrument_ids: list[int]
    selected_balanced_instrument_ids: list[int]
    selected_aggressive_instrument_ids: list[int]