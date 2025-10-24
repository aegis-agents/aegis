from dataclasses import dataclass, field
import redis.asyncio as redis
from redis.asyncio.sentinel import Sentinel
import asyncio
import atexit

from . import config
from .stats import third_party_error_counter


@dataclass(init=False)
class RedisConnection:
    redis_client: redis.Redis
    redis_url: str = field(init=False)
    AEGIS_USER_USED_CREDITS: str = "user_credits"

    def __init__(self):
        self.redis_url = config.redis.url

    @staticmethod
    async def construct():
        conn = RedisConnection()

        # Initialize Redis connection
        if isinstance(conn.redis_url, str):
            print("[RedisConnection - construct] Connecting to single Redis instance")
            conn.redis_client = redis.from_url(conn.redis_url)
        else:
            print("[RedisConnection - construct] Connecting to Redis Sentinel")
            startup_nodes = []
            for url in conn.redis_url:
                host, port = url.split(":")
                startup_nodes.append((host, int(port)))

            sentinel = Sentinel(sentinels=startup_nodes, socket_timeout=1.0, sentinel_kwargs={"password": config.redis.password})

            conn.redis_client = sentinel.master_for(
                service_name="mymaster",
                password=config.redis.password
            )

        # Test the connection
        try:
            await conn.redis_client.ping()
            print("[RedisConnection - construct] Redis connection established")
        except redis.ConnectionError as e:
            third_party_error_counter.labels(service_name='redis').inc()
            print(f"[RedisConnection - construct] Redis connection error: {e}")
            raise e
        return conn

    async def close(self):
        await self.redis_client.close()
        await self.redis_client.connection_pool.disconnect()
        print("[RedisConnection - close] Redis connection closed")


redis_conn: RedisConnection | None = None
redis_lock = asyncio.Lock()


async def get_redis_connection() -> RedisConnection:
    global redis_conn
    if redis_conn is None:
        async with redis_lock:
            if redis_conn is None:  # Double-checked locking
                redis_conn = await RedisConnection.construct()
    return redis_conn


def close_redis_on_exit():
    global redis_conn
    if redis_conn:
        try:
            asyncio.get_event_loop().run_until_complete(redis_conn.close())
        except Exception as e:
            print(f"Error closing Redis: {e}")


atexit.register(close_redis_on_exit)
