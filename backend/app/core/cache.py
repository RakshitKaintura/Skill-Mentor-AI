import json
import logging
from typing import Optional, Any, Callable, Awaitable
import redis.asyncio as redis
from app.core.config import get_settings

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self):
        settings = get_settings()
        self.redis_url = settings.redis_url
        self._redis: Optional[redis.Redis] = None

    async def get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def get(self, key: str) -> Optional[Any]:
        try:
            client = await self.get_redis()
            data = await client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"Redis get error for {key}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int = 86400) -> None:
        try:
            client = await self.get_redis()
            await client.set(key, json.dumps(value), ex=ttl)
        except Exception as e:
            logger.warning(f"Redis set error for {key}: {e}")

    async def get_or_set(self, key: str, fallback_func: Callable[[], Awaitable[Any]], ttl: int = 86400) -> Any:
        cached = await self.get(key)
        if cached is not None:
            return cached
        
        # Call the fallback to generate the data
        value = await fallback_func()
        
        # Save it to cache
        await self.set(key, value, ttl)
        return value

# Singleton instance
cache_manager = CacheManager()
