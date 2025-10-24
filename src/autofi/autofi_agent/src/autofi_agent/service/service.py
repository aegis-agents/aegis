from __future__ import annotations
import asyncio
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import HumanMessage
from nats.aio.subscription import Subscription

from autofi_core import (get_nats_connection, close_nats_connection, config, logger,
                         SUBJECTS_HELPER_EGRESS_IMMEDIATELY_SCHEDULING, get_redis_connection)
from autofi_core.common.messages import HelperEgressImmediatelySchedulingRequest
from autofi_agent.graph import build_graph
from .distributed_lock import RedisLock


lock_name = "autofi_invoke_graph"


class AgentService:

    def __init__(self):
        self.nats_conn = None
        self.graph = None
        self.thread_id = config.llm.thread_id
        self.initialized = False
        self.sid: Subscription | None = None
        self._stop_event = asyncio.Event()
        self.lock = None
        self.cron_task = None
        self.listen_task = None

    @classmethod
    async def construct(cls) -> AgentService:
        agent_service = cls()
        agent_service.nats_conn = await get_nats_connection(config.nats.url, config.nats.timeout)
        agent_service.graph = await build_graph()
        agent_service.initialized = True
        redis_conn = await get_redis_connection()
        agent_service.lock = RedisLock(redis_conn=redis_conn.redis_client, key=lock_name, ttl=1200)

        return agent_service

    async def start(self) -> None:
        if not self.initialized:
            raise RuntimeError("AgentService is not initialized. Call construct() first")
        loop = asyncio.get_running_loop()
        self.listen_task = loop.create_task(self.listen())
        self.cron_task = loop.create_task(self.cron())
        logger.debug("[AgentService - start] AgentService started")

    async def cron(self):
        while not self._stop_event.is_set():
            logger.info("[AgentService - cron] Cron job running, invoking graph...")
            try:
                await self.invoke_graph()
            except Exception as e:
                logger.error(f"[AgentService - cron] Error invoking graph: {e}")
            logger.info("[AgentService - cron] Cron job completed, waiting for next interval")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=config.llm.cron_interval)
                break
            except asyncio.TimeoutError:
                continue

    async def listen(self):
        async def message_handler(msg):
            try:
                request = HelperEgressImmediatelySchedulingRequest.model_validate_json(msg.data)
                logger.info(f"[AgentService - message_handler] process immediately scheduling request {request.req_id}, "
                            f"from user {request.uid}")

                await self.invoke_graph()
            except Exception as e:
                logger.error(f"[AgentService - message_handler] Error processing message: {e}")

        # Start listening for messages
        self.sid = await self.nats_conn.client.subscribe(SUBJECTS_HELPER_EGRESS_IMMEDIATELY_SCHEDULING, cb=message_handler)
        logger.debug(f"[AgentService - message_handler] subscribed to subject {SUBJECTS_HELPER_EGRESS_IMMEDIATELY_SCHEDULING}")

    async def invoke_graph(self):
        try:
            async with self.lock:
                cfg = RunnableConfig(
                    configurable={
                        "thread_id": self.thread_id,
                    }
                )
                user_messages = {
                    "messages": [HumanMessage(content="Continue")]
                }
                try:
                    await self.graph.ainvoke(config=cfg, input=user_messages)
                except Exception as e:
                    logger.error(f"[AgentService - invoke_graph] Error invoking graph: {e}")
        except Exception as e:
            logger.warning(
                f"[AgentService - invoke_graph] Service is already processing a request. Skipping invocation. {e}")
            return

    async def close(self):
        if not self.initialized:
            logger.warning("[AgentService - close] AgentService is not initialized. Nothing to close.")
            return
        try:
            self._stop_event.set()
            if self.cron_task:
                await self.cron_task
            if self.listen_task:
                self.listen_task.cancel()
                try:
                    await self.listen_task
                except asyncio.CancelledError:
                    pass
            if self.sid:
                await self.sid.unsubscribe()
            await close_nats_connection()
            self.lock.release()
        except Exception as e:
            logger.error(f"[AgentService - close] Error closing NATS connection: {e}")
