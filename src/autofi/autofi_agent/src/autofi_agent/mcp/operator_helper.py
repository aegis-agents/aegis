import uuid
from fastmcp import FastMCP, Context
from contextlib import asynccontextmanager
from typing import AsyncIterator, Any
import nats.errors as nats_errors
import json
from pydantic import Field
import asyncio
import logging
from fastmcp.utilities.logging import get_logger

from autofi_core import (get_nats_connection, close_nats_connection, NATSError, config,
                         SUBJECTS_HELPER_INGRESS_GET_ALL_USERS_INVESTMENTS,
                         SUBJECTS_HELPER_INGRESS_INTENT_TRANSACTION,
                         SUBJECTS_PROCESSED_HELPER)
from autofi_core.common.messages import (HelperGetAllUsersInvestmentsRequest, HelperGetAllUsersInvestmentsResponse,
                                         UserInstrumentsIntent, HelperInstrumentsIntentRequest,
                                         HelperInstrumentsIntentResponse, HelperResponse)


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
            logger.error(f"error closing NATS connection: {str(e)}")


# Initialize FastMCP server instance.
mcp = FastMCP(
    name="AegisHelperMPCServer",
    instructions="""
        This server deals with Agents' request. 
        """,
    lifespan=server_lifespan,  # Use the lifespan context manager
)


@mcp.tool()
async def create_intent_transaction(ctx: Context,
                                    intents: list[UserInstrumentsIntent] = Field(
                                        description="A list of user intents for which to create transactions"),
                                    ) -> str:
    """
    Creates intent transactions for users, taking into account their investment strategies and current market analysis.
    """
    if not intents:
        await ctx.error("No intents provided for transaction creation.")
        return "No intents provided for transaction creation."

    try:
        resp = await send_intent_transaction(intents)
        lines = [
            "Intent Transaction Report: "
        ]
        if resp.error:
            await ctx.error(f"Error in response: {resp.error}")
            lines.append(f"( with error in response: {resp.error})")
        for intent in resp.intents:
            i: dict = {
                "uid": intent.uid,
                "inclined_instrument_id": intent.inclined_instrument_id,
                "reason": intent.reason,
                "path": intent.path if intent.path else "None",
                "error": intent.error if intent.error else "None"
            }
            lines.append(json.dumps(i, ensure_ascii=False, indent=2))
        return "\n".join(lines)

    except asyncio.TimeoutError:
        await ctx.error(f"Timeout waiting for async response for request")
        return f"Internal error while requesting the create_intent_transaction tool: timeout."
    except nats_errors.Error as e:
        await ctx.error("NATS request error: " + str(e))
        return "internal error when requesting create_intent_transaction tool"
    except Exception as e:
        await ctx.error("Unexpected error: " + str(e))
        return f"error when requesting create_intent_transaction tool {e}"


async def send_intent_transaction(intents: list[UserInstrumentsIntent]) -> HelperInstrumentsIntentResponse:
    nats = await get_nats_connection(config.nats.url, config.nats.timeout)
    req_id = str(uuid.uuid4())
    reply_subject = f"{SUBJECTS_PROCESSED_HELPER}.{req_id}"
    logger.debug(f"Created request ID {req_id} for create_intent_transaction")

    loop = asyncio.get_running_loop()
    future = loop.create_future()

    async def message_handler(msg):
        try:
            async_resp = HelperInstrumentsIntentResponse.model_validate_json(msg.data)
            future.set_result(async_resp)
        except Exception as e:
            future.set_exception(e)

    sid = await nats.client.subscribe(reply_subject, cb=message_handler)
    try:
        req = HelperInstrumentsIntentRequest(
            req_id=req_id,
            intents=intents
        )
        response = await nats.client.request(
            subject=SUBJECTS_HELPER_INGRESS_INTENT_TRANSACTION,
            payload=req.model_dump_json().encode("utf-8"),
            timeout=50
        )

        resp = HelperResponse.model_validate_json(response.data)
        if resp.error:
            raise NATSError(f"Error in response: {resp.error}")

        r = await asyncio.wait_for(future, timeout=config.nats.async_response_timeout)

        return r
    except Exception as e:
        raise e
    finally:
        await sid.unsubscribe()


async def get_all_investments_with_offset(offset: int) -> HelperGetAllUsersInvestmentsResponse | None:
    nats = await get_nats_connection(config.nats.url, config.nats.timeout)
    req_id = str(uuid.uuid4())
    reply_subject = f"{SUBJECTS_PROCESSED_HELPER}.{req_id}"

    # Create a future to wait for the asynchronous response
    loop = asyncio.get_running_loop()
    future = loop.create_future()

    async def message_handler(msg):
        try:
            async_resp = HelperGetAllUsersInvestmentsResponse.model_validate_json(msg.data)
            if async_resp.error:
                future.set_exception(NATSError(f"Error in response: {async_resp.error}"))
            else:
                future.set_result(async_resp)
        except Exception as e:
            future.set_exception(e)

    sid = await nats.client.subscribe(reply_subject, cb=message_handler)

    req = HelperGetAllUsersInvestmentsRequest(
        req_id=req_id,
        offset=offset,
        limit=100
    )
    response = await nats.client.request(
        subject=SUBJECTS_HELPER_INGRESS_GET_ALL_USERS_INVESTMENTS,
        payload=req.model_dump_json().encode("utf-8"),
        timeout=100
    )
    resp = HelperResponse.model_validate_json(response.data)
    if resp.error:
        raise NATSError(f"Error in response: {resp.error}")

    try:
        r = await asyncio.wait_for(future, timeout=config.nats.async_response_timeout)
        return r
    except asyncio.TimeoutError:
        raise NATSError(f"Timeout waiting for async response for req_id {req_id}")
    finally:
        await sid.unsubscribe()


# Run the server
if __name__ == "__main__":
    logger.info(f"Starting .........")
    mcp.run(transport='stdio')
