import uuid
from fastmcp import FastMCP, Context
from contextlib import asynccontextmanager
from typing import AsyncIterator, Any, Dict
import nats.errors as nats_errors
import json
from datetime import datetime
import logging
from fastmcp.utilities.logging import get_logger

from autofi_core import (get_nats_connection, close_nats_connection, NATSError, config,
                         SUBJECTS_HELPER_INGRESS_GET_INSTRUMENTS, SUBJECTS_HELPER_INGRESS_INVESTMENT_RECOMMENDATION,
                         SUBJECTS_QUERIER_INGRESS_IMMEDIATELY_QUERY)
from autofi_core.common.messages import (HelperGetInstrumentsRequest, HelperGetInstrumentsResponse,
                                         HelperGetInvestment, HelperIngressInvestmentRecommendationRequest,
                                         QuerierIngressQuerierImmediatelyQueryRequest)
from autofi_core.common.model import InvestmentExpertSelectedModel


previous_batch_id = ""
current_batch_id = ""
InvestmentsByInclination = Dict[str, Dict[str, HelperGetInvestment]]
UserInvestmentsBatch = Dict[str, InvestmentsByInclination]
user_investments_batch: UserInvestmentsBatch = {}
logger = get_logger(__name__)
logger.setLevel(logging.WARNING)


@asynccontextmanager
async def server_lifespan(server: FastMCP) -> AsyncIterator[dict[str, Any]]:
    """Manage server startup and shutdown lifecycle"""
    # Global connection is used; no need to establish a new connection here.

    try:
        # Verify NATS availability on startup by initializing global connection.
        try:
            await get_nats_connection(config.nats.url, config.nats.timeout)
        except Exception as e:
            raise NATSError(f"could not connect to nats on startup: {str(e)}")

        # Yield an empty context (global connection used).
        yield {}
    finally:
        # Clean up global connection on shutdown.
        try:
            await close_nats_connection()
        except Exception as e:
                print(f"error closing NATS connection: {str(e)}")


# Initialize FastMCP server instance.
mcp = FastMCP(
    name="AegisHelperMPCServer",
    instructions="""
        This server deals with Agents' request. 
        """,
    lifespan=server_lifespan,  # Use the lifespan context manager
)


@mcp.tool()
async def get_instruments(ctx: Context) -> str:
    """
    Get all instruments that are pools in which AutoFi can help users invest (such as Morpho’s Vaults, Aave’s Pools, etc.).
    This tool will return the basic information of each pool, its investment strategy category (CONSERVATIVE, BALANCED, or AGGRESSIVE), its APY details, and its current liquidity.

    Returns:
        str: Instruments with their details.
    """
    try:
        nats = await get_nats_connection(config.nats.url, config.nats.timeout)
        req_id = str(uuid.uuid4())
        await ctx.debug(f"Created request ID {req_id} for get instruments")
        req = HelperGetInstrumentsRequest(
            req_id=req_id,
            with_data=True
        )
        response = await nats.client.request(
            subject=SUBJECTS_HELPER_INGRESS_GET_INSTRUMENTS,
            payload=req.model_dump_json().encode("utf-8"),
            timeout=5
        )
        resp = HelperGetInstrumentsResponse.model_validate_json(response.data)
        if resp.error:
            await ctx.error(f"Error in response: {resp.error}")
            content = f"error occurred when requesting get_instruments tool: {resp.error}"
            return content
        if len(resp.instruments) == 0:
            content = "no instruments found"
            return content
        lines = [
            f"{len(resp.instruments)} investment pools found.",
            "Each pool includes: basic information, strategy category (CONSERVATIVE, BALANCED, AGGRESSIVE), "
            "APY, and current liquidity.",
        ]
        for instrument in resp.instruments:
            i: dict = {
                "instrument_id": instrument.instrument_id,
                "chain_id": instrument.chain_id,
                "protocol_name": instrument.protocol_name,
                "strategy_type": get_human_readable_strategy_inclination(instrument.strategy_type),
                "underlying_asset": instrument.underlying_asset,
                "underlying_asset_token_symbol": instrument.symbol,
                "curator": instrument.curator,
            }
            if instrument.instrument_data:
                i["instrument_data"] = [
                    {
                        "hourly_timestamp": get_human_readable_time(data.hourly_timestamp),
                        "apy": data.apy,
                        "supply_amount": data.supply_amount,
                        "supply_amount_in_usd": data.supply_amount_usd,
                        "utilization": data.utilization
                    } for data in instrument.instrument_data
                ]
            lines.append(json.dumps(i, ensure_ascii=False, indent=2))
        return "\n".join(lines)
    except nats_errors.Error as e:
        await ctx.error("NATS request error: " + str(e))
        return "internal error when requesting get_instruments tool"
    except Exception as e:
        await ctx.error("Unexpected error: " + str(e))
        return f"error when requesting get_instruments tool {e}"


async def send_investment_recommendations(selection: InvestmentExpertSelectedModel):
    try:
        nats = await get_nats_connection(config.nats.url, config.nats.timeout)
        req_id = str(uuid.uuid4())
        logger.debug(f"Created request ID {req_id} for send investment recommendations")
        req = HelperIngressInvestmentRecommendationRequest(
            req_id=req_id,
            recommendation=selection,
        )
        await nats.client.publish(
            subject=SUBJECTS_HELPER_INGRESS_INVESTMENT_RECOMMENDATION,
            payload=req.model_dump_json().encode("utf-8"),
        )

    except nats_errors.Error as e:
        logger.error(f"NATS request error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")


async def send_querier_immediate_query():
    try:
        req = QuerierIngressQuerierImmediatelyQueryRequest(
            req_id=str(uuid.uuid4()),
            queriers=get_all_queriers()
        )
        nats = await get_nats_connection(config.nats.url, config.nats.timeout)
        await nats.client.publish(
            subject=SUBJECTS_QUERIER_INGRESS_IMMEDIATELY_QUERY,
            payload=req.model_dump_json().encode("utf-8"),
        )
    except nats_errors.Error as e:
        logger.error(f"NATS request error: {e}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")


def get_all_queriers() -> list[str]:
    queriers = []
    queriers.append("8453-aave-querier")
    queriers.append("8453-morpho-querier")
    return queriers


def get_human_readable_time(timestamp: int) -> str:
    try:
        dt = datetime.fromtimestamp(timestamp)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return str(timestamp)


def get_human_readable_strategy_inclination(strategy_type: str) -> str:
    """
    Convert strategy type code to human-readable string.
    """
    if strategy_type == "0":
        return "DISABLED"
    elif strategy_type == "1":
        return "CONSERVATIVE"
    elif strategy_type == "2":
        return "BALANCED"
    elif strategy_type == "3":
        return "AGGRESSIVE"
    else:
        return "UNKNOWN"


# Run the server
if __name__ == "__main__":
    print("Starting MCP server with stdio transport")
    mcp.run(transport='stdio')
