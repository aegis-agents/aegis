import asyncio
import signal
from prometheus_client import start_http_server
from autofi_agent import AgentService
from autofi_core import logger
import os

async def main():
    agent_service = await AgentService.construct()
    await agent_service.start()
    stop_event = asyncio.Event()
    logger.info(f"[main] AutoFi agent service started")

    loop = asyncio.get_running_loop()

    def ask_shutdown():
        asyncio.create_task(agent_service.close())
        stop_event.set()

    loop.add_signal_handler(signal.SIGINT, ask_shutdown)
    if hasattr(signal, "SIGTERM"):
        loop.add_signal_handler(signal.SIGTERM, ask_shutdown)

    await stop_event.wait()
    logger.info("[main] stop_event set, now waiting for all tasks to finish...")


if __name__ == '__main__':

    start_http_server(9111)
    logger.info(f"Prometheus metrics server started on port 9111")
    asyncio.run(main())
