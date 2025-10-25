from pydantic import BaseModel, Field


class RiskProfile(BaseModel):
    instrument_id: int
    symbol: str
    protocol_name: str
    instrument_name: str
    risk: str
    risk_level: str
    timestamp: int


class GetRiskProfileResponseData(BaseModel):
    risk_profiles: list[RiskProfile] | None = None


class GetRiskProfilesResponse(BaseModel):
    return_code: int = Field(alias='returnCode')
    message: str
    data: GetRiskProfileResponseData
