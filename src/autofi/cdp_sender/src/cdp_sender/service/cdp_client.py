from __future__ import annotations

from cdp import CdpClient
from cdp.evm_call_types import EncodedCall
from nats.errors import Error as NatsError
from web3 import Web3
from decimal import Decimal
import asyncio
from typing import Callable, TypeVar, Awaitable

from autofi_core import (
    get_nats_connection,
    close_nats_connection,
    NatsConnection,
    VaultAccount,
    VaultGrpcClient,
    SUBJECTS_PROCESSED,
    SUBJECTS_CDP_SENDER_INGRESS_GET_SMART_ADDRESS,
    SUBJECTS_CDP_SENDER_INGRESS_SEND_USER_OPERATION,
    CdpSendUserOperationRequest,
    CdpSendUserOperationResponse,
    CdpSendGetSmartAddressRequest,
    CdpSendGetSmartAddressResponse,
    logger,
    request_time,
    third_party_error_counter,
    get_cdp_chain_id_network,
    config
)


T = TypeVar("T")


async def retry_async(
    func: Callable[[], Awaitable[T]],
    retries: int = 3,
    delay: float = 1.0,
    exceptions: tuple = (Exception,)
) -> T:
    """
    Retries an async function up to `retries` times if exceptions occur.

    Args:
        func: An async function with no arguments to execute.
        retries: Number of retries.
        delay: Delay (seconds) between retries.
        exceptions: Exception types to catch and retry on.

    Returns:
        The return value of func.

    Raises:
        The last exception if all retries fail.
    """
    for attempt in range(1, retries + 1):
        try:
            return await func()
        except exceptions as e:
            if attempt < retries:
                logger.warning(f"[Retry] Attempt {attempt} failed: {e} -- Retrying in {delay}s...")
                await asyncio.sleep(delay)
            else:
                logger.error(f"[Retry] All {retries} attempts failed.")
                raise


class CdpSender:
    """
    Service for listening to NATS messages and forwarding user operations.

    Responsibilities:
      - Subscribes to a specific NATS subject to receive `CdpSendUserOperationRequest` messages.
      - Validates chain ID, user operation parameters, and account information.
      - Interacts with blockchain and account services via `cdp_client` and `vault_client`.
      - Sends asynchronous responses with processing results back to NATS.

    Attributes:
        initialized (bool): Whether the sender has been initialized.
        cdp_client (CdpClient | None): Instance of the CDP client.
        nats_conn (NatsConnection | None): Instance of the NATS connection.
        vault_client (VaultGrpcClient | None): Instance of the Vault gRPC client.

    Example:
        sender = await CdpSender.construct()
        await sender.listen()
        # ... (other application logic)
        await sender.close()
    """

    def __init__(self):
        self.initialized = False
        self.cdp_client = None
        self.nats_conn = None
        self.vault_client = None

    @classmethod
    async def construct(cls) -> CdpSender:
        """
        Asynchronously constructs and initializes a `CdpSender` instance.

        This initializes all required resources, including the CDP client,
        NATS connection, and Vault gRPC client. Use this method to create instances
        instead of calling the constructor directly.

        Returns:
            CdpSender: An initialized instance of `CdpSender`.
        """
        sender = cls()
        sender.cdp_client = CdpClient()
        sender.nats_conn = await get_nats_connection(config.nats.url, config.nats.timeout)
        sender.vault_client = VaultGrpcClient.construct(config.vault.url)
        logger.debug("[CdpSender - construct] CdpSender constructed")
        sender.initialized = True
        return sender

    async def listen(self):
        if not self.initialized:
            raise RuntimeError("CdpSender is not initialized. Call construct() first")

        # increase the cdp error counter by 1 in order to initialize the metric
        third_party_error_counter.labels(service_name="cdp").inc()

        async def get_smart_account(msg):
            with request_time.labels("cdp_sender", "get_smart_account").time():
                logger.debug("[CdpSender - get_smart_account] Received message")
                req_id = None
                try:
                    request = CdpSendGetSmartAddressRequest.model_validate_json(msg.data)
                    req_id = request.req_id
                    address = request.owner_address
                    if not Web3.is_address(address):
                        logger.warning(f"[CdpSender - get_smart_account] Invalid smart account address {address} ")
                        resp = CdpSendGetSmartAddressResponse(
                            req_id=req_id,
                            error="Invalid smart account address",
                        )
                        await msg.respond(resp.model_dump_json().encode("utf-8"))
                        return
                    agent_account = VaultAccount(
                        conn=self.vault_client,
                        path=request.owner_path,
                        address=request.owner_address)
                    last_index = int(request.owner_path.strip().split("/")[-1])
                    account = await self.cdp_client.evm.get_or_create_smart_account(
                        owner=agent_account,
                        name=f"aegis-autofi-dev-{last_index}")
                    resp = CdpSendGetSmartAddressResponse(
                        req_id=req_id,
                        error=None,
                        smart_address=account.address
                    )
                    await msg.respond(resp.model_dump_json().encode("utf-8"))
                    logger.debug(f"[CdpSender - get_smart_account] Responded to agent address {address} with "
                                 f"smart account {account.address} for req {req_id}")

                except Exception as e:
                    logger.error(f"[CdpSender - get_smart_account] Error parsing request: {e}")
                    if req_id is not None:
                        resp = CdpSendGetSmartAddressResponse(
                            req_id=req_id,
                            error=str(e),
                        )
                        await msg.respond(resp.model_dump_json().encode("utf-8"))

        async def send_user_operation(msg):
            with request_time.labels("cdp_sender", "send_user_operation").time():
                logger.debug(f"[CdpSender - listen] Received message on subject {msg.subject}: {msg.data[:500]}")
                req_id = None
                try:
                    request = CdpSendUserOperationRequest.model_validate_json(msg.data)
                    req_id = request.req_id

                    network = get_cdp_chain_id_network(str(request.chain_id))
                    if not network:
                        logger.error(f"[CdpSender - listen] Unsupported chain_id {request.chain_id} in "
                                     f"request {req_id}")
                        await self.response_to_nats(req_id, "Invalid chain_id", None)
                        return

                    if not request.user_operation_calls:
                        logger.warning("[CdpSender - listen] No user operation calls provided in the request.")
                        await self.response_to_nats(req_id, "No user operation calls provided", None)
                        return

                    calls = []
                    for c in request.user_operation_calls:
                        value = 0
                        try:
                            value = Decimal(c.value) if c.value not in (None, "") else 0
                        except Exception:
                            value = 0
                        call = EncodedCall(
                            to=c.to,
                            data=c.data,
                            value=Web3.to_wei(value, "wei"))
                        calls.append(call)

                    account = VaultAccount(
                        conn=self.vault_client,
                        path=request.owner_path,
                        address=request.owner_address)
                    smart_account = await self.cdp_client.evm.get_smart_account(
                        address=request.smart_address,
                        owner=account)
                    logger.debug(f"[CdpSender - listen] Get cdp smart account {request.smart_address} for "
                                 f"req {req_id}")

                    async def user_op_flow():
                        logger.debug(f"[CdpSender - listen] Sending user operation for req {req_id}, "
                                     f"smart account {smart_account}, calls: {calls}, "
                                     f"network: {network}")

                        user_operation = await self.cdp_client.evm.send_user_operation(
                            smart_account=smart_account,
                            calls=calls,
                            network=network,
                            paymaster_url=config.cdp.paymaster_url)
                        logger.debug(f"[CdpSender - listen] User operation {user_operation.user_op_hash} sent for "
                                     f"req {req_id}")

                        user_operation = await self.cdp_client.evm.wait_for_user_operation(
                            smart_account_address=smart_account.address,
                            user_op_hash=user_operation.user_op_hash,
                        )
                        if user_operation.status == "complete":
                            logger.info(f"[CdpSender - listen] User operation {user_operation.user_op_hash} "
                                        f"completed for req {req_id}")
                            tx_hash = user_operation.transaction_hash
                            logger.info(f"[CdpSender - listen] User operation transaction hash: {tx_hash}")
                            await self.response_to_nats(req_id, None, tx_hash)
                        else:
                            logger.error(f"[CdpSender - listen] User operation {user_operation.user_op_hash} "
                                         f"failed for req {req_id}")
                            await self.response_to_nats(req_id, f"User operation failed: {user_operation.status}", None)

                    # Retry user_op_flow up to 3 times
                    await retry_async(user_op_flow, retries=3, delay=1.0, exceptions=(Exception,))

                except Exception as e:
                    logger.error(f"[CdpSender - listen] Error processing request {msg.subject}: {e}")
                    third_party_error_counter.labels(service_name="cdp").inc()
                    if req_id is not None:
                        await self.response_to_nats(req_id, str(e), None)
        await self.nats_conn.client.subscribe(
            SUBJECTS_CDP_SENDER_INGRESS_SEND_USER_OPERATION,
            cb=send_user_operation)
        logger.debug(f"[CdpSender - listen] Listening for messages on NATS subject "
                     f"{SUBJECTS_CDP_SENDER_INGRESS_SEND_USER_OPERATION}")

        await self.nats_conn.client.subscribe(
            SUBJECTS_CDP_SENDER_INGRESS_GET_SMART_ADDRESS,
            cb=get_smart_account)
        logger.debug(f"[CdpSender - listen] Listening for messages on NATS subject "
                     f"{SUBJECTS_CDP_SENDER_INGRESS_GET_SMART_ADDRESS}")

    async def response_to_nats(self, req_id: str, error: str | None, tx_hash: str | None = None):
        if error:
            logger.warning(f"[CdpSender - response_to_nats] Failed when processing request {req_id}: {error}")
        response = CdpSendUserOperationResponse(
            req_id=req_id,
            error=error,
            transaction_hash=tx_hash
        )
        subject = f"{SUBJECTS_PROCESSED}.{req_id}"
        try:
            await self.nats_conn.client.publish(
                subject=subject,
                payload=response.model_dump_json().encode("utf-8")
            )
        except NatsError as e:
            logger.error(f"[CdpSender - response_to_nats] {e}")
            third_party_error_counter.labels(service_name="nats").inc()

    async def close(self):
        if not self.initialized:
            logger.warning("[CdpSender - close] CdpSender is not initialized, nothing to close.")
            return
        try:
            await close_nats_connection()
            await self.cdp_client.close()
        except Exception as e:
            logger.error(f"[CdpSender - close] Error closing CdpSender: {e}")

