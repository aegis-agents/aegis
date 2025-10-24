import asyncio
import signal
from prometheus_client import start_http_server
from autofi_core import logger
from cdp_sender.service import CdpSender


async def main():
    cdp_sender = await CdpSender.construct()
    await cdp_sender.listen()

    stop_event = asyncio.Event()
    logger.info(f"[main] cdp sender started")

    loop = asyncio.get_running_loop()

    def ask_shutdown():
        asyncio.create_task(cdp_sender.close())
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
