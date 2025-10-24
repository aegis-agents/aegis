from langgraph.prebuilt.chat_agent_executor import AgentState
from pydantic import BaseModel, Field, ConfigDict
from typing import TypedDict, Literal, Any


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
    Path: None = Field(
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


class SelectedInstrumentByInclinationState(TypedDict):
    instrument_id: int  # The unique identifier for the selected instrument.
    protocol_name: str  # The DeFi protocol which the instrument is based on.
    current_apy: float  # The newest APY of the instrument, reflecting its current performance.
    recommendation_score: int  # A score from 1 to 100 indicating the recommendation strength for this instrument based on the client's inclination.
    reason: str  # A brief reason why this instrument is selected.


class SelectedInstrumentByInclination(BaseModel):
    instrument_id: int = Field(
        description="The unique identifier for the selected instrument.",
        examples=[1, 5, 18]
    )

    protocol_name: str = Field(
        description="The DeFi protocol which the instrument is based on.",
        examples=["morpho", "aave"]
    )

    current_apy: float = Field(
        description="The newest APY of the instrument, reflecting its current performance.",
        examples=[0.010074, 0.050199]
    )
    recommendation_score: int = Field(
        description="A score from 1 to 100 indicating the recommendation strength for this instrument based on the client's inclination. Scores below 75 indicate not recommended, while scores above 90 indicate highly recommended. Scores should be assigned strictly.",
        examples=[70, 75, 88, 90, 92]
    )
    reason: str = Field(
        description="A brief reason why this instrument is selected.",
        examples=["Morpho USDC offers a stable yield and consistently rising APY around 3.2%."]
    )

    def to_state(self) -> SelectedInstrumentByInclinationState:
        """Convert the model instance to a state representation."""
        return SelectedInstrumentByInclinationState(
            instrument_id=self.instrument_id,
            protocol_name=self.protocol_name,
            current_apy=self.current_apy,
            recommendation_score=self.recommendation_score,
            reason=self.reason
        )


class SelectedInstruments(BaseModel):
    selection_for_conservative_clients: list[SelectedInstrumentByInclination] = Field(
        description="List of selected instruments for clients with a CONSERVATIVE investment inclination."
    )
    selection_for_balanced_clients: list[SelectedInstrumentByInclination] = Field(
        description="List of selected instruments for clients with a BALANCED investment inclination"
    )
    selection_for_aggressive_clients: list[SelectedInstrumentByInclination] = Field(
        description="List of selected instruments for clients with a AGGRESSIVE investment inclination"
    )

    def to_state(self):
        return {
            "1": [
                i.to_state() for i in self.selection_for_conservative_clients
            ],
            "2": [
                i.to_state() for i in self.selection_for_balanced_clients
            ],
            "3": [
                i.to_state() for i in self.selection_for_aggressive_clients
            ],
        }


class OperatorWork(BaseModel):
    strategy_type: Literal["conservative", "balanced", "aggressive"] = Field(
        description="The investment strategy type for which the operator is assisting users with. "
                    "Must be one of 'conservative', 'balanced', or 'aggressive'. ",
        examples=["conservative", "balanced", "aggressive"]
    )
    work_done: bool = Field(
        default=False,
        description="Indicates whether the operator has completed their work for the current batch. "
                    'This field should be set to True if a response of "all works are done" is received '
                    'from calling tools.'
    )
    user_instruments_intent: UserInstrumentsIntent = Field(
        default_factory=UserInstrumentsIntent,
        description="If there is work to be done, this field should be populated with the contents "
                    "returned by the 'create_intent_transaction' tool after you calling it."
                    "If there is no work to be done, this field should be set to an empty UserInstrumentsIntent instance."
    )
    # OpenAI forbid extra fields in the nested model
    model_config = ConfigDict(extra="forbid")


# States
class State(AgentState):
    batch_id: str
    current_time: str
    risk_reports: str
    investment_recommendations: dict[str, list[SelectedInstrumentByInclinationState]]
    work_done: dict[str, bool]
    structured_response: dict[str, Any] | None
    message_delete_cursor: int | None
    user_investments: str | None
