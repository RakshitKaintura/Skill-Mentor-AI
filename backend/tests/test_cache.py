import pytest
from unittest.mock import AsyncMock
from app.core.cache import CacheManager

@pytest.mark.anyio
async def test_cache_manager_get_or_set_miss():
    """Test that get_or_set calls the fallback function when cache is missed."""
    manager = CacheManager()
    
    # Mock internal methods
    manager.get = AsyncMock(return_value=None)
    manager.set = AsyncMock()
    
    # Mock fallback function
    fallback = AsyncMock(return_value={"data": "success"})
    
    result = await manager.get_or_set("test_key", fallback)
    
    assert result == {"data": "success"}
    fallback.assert_called_once()
    manager.set.assert_called_once_with("test_key", {"data": "success"}, 86400)

@pytest.mark.anyio
async def test_cache_manager_get_or_set_hit():
    """Test that get_or_set returns cached data and does NOT call fallback."""
    manager = CacheManager()
    
    # Mock internal methods
    manager.get = AsyncMock(return_value={"data": "cached"})
    manager.set = AsyncMock()
    
    # Mock fallback function
    fallback = AsyncMock(return_value={"data": "new"})
    
    result = await manager.get_or_set("test_key", fallback)
    
    assert result == {"data": "cached"}
    fallback.assert_not_called()
    manager.set.assert_not_called()
