from dataclasses import dataclass
import asyncio
from nats.aio.client import Client


@dataclass
class NatsConnection:
    uri: str
    timeout: int
    client: Client | None = None

    async def connect(self):
        self.client = Client()
        await self.client.connect(servers=[self.uri], connect_timeout=self.timeout)

    async def disconnect(self):
        if self.client:
            await self.client.drain()
            await self.client.close()
            self.client = None


nats_conn: NatsConnection | None = None
nats_lock = asyncio.Lock()


async def get_nats_connection(url: str, timeout: int) -> NatsConnection:
    global nats_conn
    if nats_conn is None:
        async with nats_lock:
            if nats_conn is None:  # Double-checked locking
                nats_conn = NatsConnection(
                    uri=url,
                    timeout=timeout
                )
                await nats_conn.connect()
    return nats_conn


async def close_nats_connection():
    global nats_conn
    if nats_conn:
        await nats_conn.disconnect()
        nats_conn = None
