class SelectedInstrumentByInclination {
  instrument_id int @description("The unique identifier for the selected instrument.")
  current_apy float @description("The newest APY of the instrument, reflecting its current performance.")
  recommendation_score int @description("A score from 1 to 100 indicating the recommendation strength for this instrument based on the client's inclination. Scores below 75 indicate not recommended, while scores above 90 indicate highly recommended. Scores should be assigned strictly.")
  reason string @description("A brief reason why this instrument is selected.")
}

// Define the structure for the SelectInvestment output
class SelectedInstruments {
  selection_for_conservative_clients SelectedInstrumentByInclination[] @description("The selected instruments for clients with a CONSERVATIVE investment inclination.")
  selection_for_balanced_clients SelectedInstrumentByInclination[] @description("The selected instruments for clients with a BALANCED investment inclination.")
  selection_for_aggressive_clients SelectedInstrumentByInclination[] @description("The selected instruments for clients with an AGGRESSIVE investment inclination.")
}

// Define SelectInvestment
function SelectInvestment(instrument_info: string, risk_reports: string) -> SelectedInstruments {
  // Specifies the client to use for the LLM call.
  client AegisGPTo4mini

  // Prompt definition using BAML's syntax
  prompt #"
    You are a DeFi investment expert. Your responsibility is to select suitable DeFi investment instruments for different types of clients.

    Your clients are categorized into three groups based on their investment inclinations: CONSERVATIVE, BALANCED, and AGGRESSIVE, with risk tolerance increasing in that order.

    Each instrument is classified as CONSERVATIVE, BALANCED, or AGGRESSIVE based on its risk level.
    You are not allowed to select BALANCED or AGGRESSIVE instruments for clients with a CONSERVATIVE investment inclination.
    However, for clients with a higher risk inclination (e.g., AGGRESSIVE), you may also select instruments from more conservative categories (i.e., BALANCED or CONSERVATIVE).

    Your selection should be based on the following three factors:

    1. The client’s investment inclination (CONSERVATIVE, BALANCED, or AGGRESSIVE);
    2. The historical APY performance of the instruments;
    3. The risk profile of the instruments.

    Information about each instrument and its historical APY:
    {{ instrument_info }}

    Instrument risk reports:
    {{ risk_reports }}

     ----
    {{ ctx.output_format }}
  "#
}


// Test cases for the TestSelectInvestmentWithMoreInstruments function
test TestSelectInvestmentWithMoreInstruments {
  functions [SelectInvestment]
  args {
    instrument_info #"""
    [
        {
          "instrument_id": 101,
          "chain_id": 1,
          "protocol_name": "Morpho",
          "strategy_type": "CONSERVATIVE",
          "underlying_asset": "USDC",
          "underlying_asset_token_symbol": "USDC",
          "curator": "Morpho Labs",
          "instrument_data": [
            {
              "hourly_timestamp": "2024-07-23 10:00:00",
              "apy": 3.12,
              "supply_amount": 200000,
              "supply_amount_in_usd": 200000,
              "utilization": 0.82
            },
            {
              "hourly_timestamp": "2024-07-24 08:00:00",
              "apy": 3.18,
              "supply_amount": 200500,
              "supply_amount_in_usd": 200500,
              "utilization": 0.84
            },
            {
              "hourly_timestamp": "2024-07-24 12:00:00",
              "apy": 3.21,
              "supply_amount": 200900,
              "supply_amount_in_usd": 200900,
              "utilization": 0.85
            }
          ]
        },
        {
          "instrument_id": 202,
          "chain_id": 1,
          "protocol_name": "Aave",
          "strategy_type": "BALANCED",
          "underlying_asset": "DAI",
          "underlying_asset_token_symbol": "DAI",
          "curator": "Aave Team",
          "instrument_data": [
            {
              "hourly_timestamp": "2024-07-23 10:00:00",
              "apy": 6.42,
              "supply_amount": 148000,
              "supply_amount_in_usd": 148000,
              "utilization": 0.70
            },
            {
              "hourly_timestamp": "2024-07-24 08:00:00",
              "apy": 6.65,
              "supply_amount": 149500,
              "supply_amount_in_usd": 149500,
              "utilization": 0.71
            },
            {
              "hourly_timestamp": "2024-07-24 12:00:00",
              "apy": 6.70,
              "supply_amount": 150000,
              "supply_amount_in_usd": 150000,
              "utilization": 0.72
            }
          ]
        },
        {
          "instrument_id": 303,
          "chain_id": 1,
          "protocol_name": "TurboYield",
          "strategy_type": "AGGRESSIVE",
          "underlying_asset": "ETH",
          "underlying_asset_token_symbol": "ETH",
          "curator": "Turbo Finance",
          "instrument_data": [
            {
              "hourly_timestamp": "2024-07-23 10:00:00",
              "apy": 15.2,
              "supply_amount": 9500,
              "supply_amount_in_usd": 30500,
              "utilization": 0.96
            },
            {
              "hourly_timestamp": "2024-07-24 08:00:00",
              "apy": 16.8,
              "supply_amount": 9800,
              "supply_amount_in_usd": 31500,
              "utilization": 0.97
            },
            {
              "hourly_timestamp": "2024-07-24 12:00:00",
              "apy": 17.5,
              "supply_amount": 10000,
              "supply_amount_in_usd": 32000,
              "utilization": 0.98
            }
          ]
        },
        {
          "instrument_id": 404,
          "chain_id": 137,
          "protocol_name": "PolygonSafe",
          "strategy_type": "CONSERVATIVE",
          "underlying_asset": "USDT",
          "underlying_asset_token_symbol": "USDT",
          "curator": "Polygon Foundation",
          "instrument_data": [
            {
              "hourly_timestamp": "2024-07-23 10:00:00",
              "apy": 2.95,
              "supply_amount": 180000,
              "supply_amount_in_usd": 180000,
              "utilization": 0.80
            },
            {
              "hourly_timestamp": "2024-07-24 08:00:00",
              "apy": 3.00,
              "supply_amount": 181200,
              "supply_amount_in_usd": 181200,
              "utilization": 0.82
            },
            {
              "hourly_timestamp": "2024-07-24 12:00:00",
              "apy": 3.05,
              "supply_amount": 182500,
              "supply_amount_in_usd": 182500,
              "utilization": 0.83
            }
          ]
        },
        {
          "instrument_id": 505,
          "chain_id": 56,
          "protocol_name": "BNBMax",
          "strategy_type": "BALANCED",
          "underlying_asset": "BNB",
          "underlying_asset_token_symbol": "BNB",
          "curator": "BNB Team",
          "instrument_data": [
            {
              "hourly_timestamp": "2024-07-23 10:00:00",
              "apy": 8.1,
              "supply_amount": 8000,
              "supply_amount_in_usd": 24000,
              "utilization": 0.88
            },
            {
              "hourly_timestamp": "2024-07-24 08:00:00",
              "apy": 8.3,
              "supply_amount": 8200,
              "supply_amount_in_usd": 24600,
              "utilization": 0.89
            },
            {
              "hourly_timestamp": "2024-07-24 12:00:00",
              "apy": 8.5,
              "supply_amount": 8300,
              "supply_amount_in_usd": 24900,
              "utilization": 0.90
            }
          ]
        }
]
    """#
    risk_reports #"""
Instrument 101 (Morpho): Risk score 2/10. Audited by Certik. No major incidents.
Instrument 202 (Aave): Risk score 5/10. Audited, with some past liquidation events.
Instrument 303 (TurboYield): Risk score 8/10. Not fully audited. Historical incidents of high volatility.
Instrument 404 (PolygonSafe): Risk score 3/10. Audited. No significant incidents.
Instrument 505 (BNBMax): Risk score 6/10. Audited, but new platform. No major incidents reported yet.
    """#
  }
}
