from pydantic import BaseModel, Field, ConfigDict
from .model import (AegisUserModel, MandateModel, PositionMetaModel, PositionDataModel, InstrumentMetaModel,
                    AutoTransactionModel, InvestmentExpertSelectedModel)
from typing import Dict


class UserOperationCall(BaseModel):
    to: str
    data: str
    value: int | None = None


class CdpSendUserOperationRequest(BaseModel):
    req_id: str
    owner_path: str
    owner_address: str
    smart_address: str
    chain_id: int
    user_operation_calls: list[UserOperationCall]


class CdpSendUserOperationResponse(BaseModel):
    req_id: str
    error: str | None = None
    transaction_hash: str | None = None


class HelperResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None


class HelperGetInstrumentsRequest(BaseModel):
    req_id: str
    chain_ids: list[str] | None = None
    instrument_ids: list[str] | None = None
    protocol_name: str | None = None
    underlying_assets: list[str] | None = None
    with_data: bool = False


class HelperGetInstrumentData(BaseModel):
    hourly_timestamp: int
    apy: str
    supply_amount: str
    supply_amount_usd: str
    borrow_amount: str
    utilization: str


class HelperGetInstrument(BaseModel):
    instrument_id: str
    chain_id: str
    protocol_name: str
    strategy_type: str
    underlying_asset: str
    symbol: str
    curator: str
    is_erc4626: bool
    erc4626_vault_address: str
    pool_address: str
    update_at: int
    instrument_data: list[HelperGetInstrumentData] | None = None


class HelperGetInstrumentsResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    instruments: list[HelperGetInstrument] = Field(default_factory=list)


class HelperGetUserRequest(BaseModel):
    req_id: str
    uid: str


class HelperGetUserResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    aegis_user: AegisUserModel


class HelperGetUserStrategyRequest(BaseModel):
    req_id: str
    uid: str


class HelperGetUserStrategyResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    mandate: MandateModel


class HelperUpdateUserStrategyRequest(BaseModel):
    req_id: str
    uid: str
    strategy: str  # '0' - disable, '1' - conservative, '2' - balanced(not supported now), '3' - aggressive(not supported now)
    immediately_scheduling: bool = False  # true - immediately schedule strategy (not supported now), default false
    signature: str


class HelperUpdateUserStrategyResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    changed: bool
    mandate: MandateModel


class HelperGetUserPositionsRequest(BaseModel):
    req_id: str
    uid: str
    with_relative_instruments: bool = False


class Position(BaseModel):
    position_meta: PositionMetaModel
    position_data: PositionDataModel


class HelperGetUserPositionsResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    positions: list[Position] = []
    instruments: list[HelperGetInstrument] | None = None


class HelperGetUserAssetsRequest(BaseModel):
    req_id: str
    uid: str
    force_update: bool = False


class UserAsset(BaseModel):
    chain_id: str
    token_address: str
    whitelisted: bool
    symbol: str
    decimals: int
    balance: str
    price: str
    value_usd: str


class Portfolio(BaseModel):
    uid: str
    user_address: str
    user_address_portfolio: list[UserAsset]
    smart_address: str
    smart_address_portfolio: list[UserAsset]
    smart_address_portfolio_value_usd: str
    smart_address_position: list[Position]
    smart_address_position_value_usd: str
    smart_address_total_value_usd: str
    base_token_price: str
    update_at: int


class HelperGetUserAssetsResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    portfolio: Portfolio


class SwapParams(BaseModel):
    uid: str
    chain_id: str
    user_address: str
    smart_address: str
    agent_path: str
    agent_address: str
    token0_address: str
    token1_address: str
    token0_amount: int | None = None  # big.Int
    at_least_token1_amount: int | None = None  # big.Int


class TransactorDepositRequest(BaseModel):
    req_id: str
    instrument_meta: InstrumentMetaModel
    amount: str
    deposit_all: bool = False
    user: AegisUserModel


class TransactorWithdrawRequest(BaseModel):
    req_id: str
    instrument_meta: InstrumentMetaModel
    amount: str
    withdraw_all: bool = False
    withdraw_to_user_account: bool = False
    user: AegisUserModel


class TransactorSwapRequest(BaseModel):
    req_id: str
    params: SwapParams


class TransactorResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    tx_hash: str | None = None


class HelperGetInvestment(BaseModel):
    user: AegisUserModel
    mandate: MandateModel
    positions: list[Position] | None = None
    last_transaction: AutoTransactionModel | None = None
    uninvested_value: str | None = None
    blacklist_protocol_names: list[str] | None = None


class HelperGetAllUsersInvestmentsRequest(BaseModel):
    req_id: str
    offset: int
    limit: int = 100


class HelperGetAllUsersInvestmentsResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    investments_by_inclination: Dict[str, Dict[str, HelperGetInvestment]]
    has_more: bool
    next_offset: int | None = None


class ChunkedRequest(BaseModel):
    type: str
    data: dict


class UserInstrumentsIntent(BaseModel):
    uid: str = Field(
        description="The UID of the user for whom the intent is being created.",
        examples=["ca5bbcde-5bd2-11f0-859b-f647b8f06edd"]
    )
    inclined_instrument_id: int = Field(
        description="The instrument ID selected for the user, based on their strategy preferences and market analysis. "
                    "Use 0 to indicate withdrawal from all existing positions.",
        examples=[0, 1, 5, 18]
    )
    path: list[ChunkedRequest] | None = Field(
        default=None,
        description="The specified path(s) for blockchain transactions. "
                    "For AI Agent requests, only `None` is supported.",
        examples=[None]
    )
    reason: str = Field(
        description="The reason for this intent, explaining the rationale behind this decision for the user.",
        examples=["Based on market analysis, Instrument ID 19 has recently offered a better APY compared to the user's "
                  "current position in Instrument ID 18. Switching the user's position to Instrument ID 19 is expected "
                  "to generate higher returns over the next seven days.",
                  "According to the user's intent, the user wishes to close all positions. Therefore, a withdrawal "
                  "operation will be executed as requested."]
    )
    error: str | None = Field(
        default=None,
        description="Error message if any occurred during intent processing. "
                    "This field is set by the server and should be ignored in requests.",
        examples=[None]
    )

    # OpenAI forbid extra fields in the nested model
    model_config = ConfigDict(extra="forbid")


class HelperInstrumentsIntentRequest(BaseModel):
    req_id: str
    intents: list[UserInstrumentsIntent]


class HelperInstrumentsIntentResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    intents: list[UserInstrumentsIntent] = Field(
        default_factory=list,
        description="List of intents processed by the server. The error field will be set if any error "
                    "occurred in the server's processing."
    )


class HelperEgressImmediatelySchedulingRequest(BaseModel):
    req_id: str
    uid: str


class CdpSendGetSmartAddressRequest(BaseModel):
    req_id: str
    owner_address: str
    owner_path: str


class CdpSendGetSmartAddressResponse(BaseModel):
    req_id: str | None = None
    error: str | None = None
    smart_address: str | None = None


class HelperIngressInvestmentRecommendationRequest(BaseModel):
    req_id: str
    recommendation: InvestmentExpertSelectedModel


class QuerierIngressQuerierImmediatelyQueryRequest(BaseModel):
    req_id: str
    queriers: list[str]
