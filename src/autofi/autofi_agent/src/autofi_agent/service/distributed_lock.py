import uuid


class RedisLock:
    def __init__(self, redis_conn, key: str, ttl: int = 1800):
        self.redis = redis_conn
        self.key = key
        self.ttl = ttl
        self.lock_value = str(uuid.uuid4())

    async def acquire(self) -> bool:
        return await self.redis.set(
            self.key, self.lock_value, nx=True, ex=self.ttl
        )

    async def release(self) -> bool:
        lua = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        result = await self.redis.eval(lua, 1, self.key, self.lock_value)
        return result == 1

    async def locked(self) -> bool:
        value = await self.redis.get(self.key)
        return value is not None

    async def __aenter__(self):
        ok = await self.acquire()
        if not ok:
            raise Exception("Lock already acquired")
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.release()
