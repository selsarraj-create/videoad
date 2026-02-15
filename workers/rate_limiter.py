"""
Sliding-window rate limiter backed by Redis sorted sets.

Each user gets a sorted set keyed by `ratelimit:{user_id}`.
Members are timestamps of recent requests; the score is the timestamp.
We trim entries older than the window and count the remainder.
"""

import time
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# Defaults — can be overridden at call sites
DEFAULT_MAX_REQUESTS = 5      # max requests per window
DEFAULT_WINDOW_SECONDS = 3600  # 1 hour


def check_rate_limit(
    redis_client,
    user_id: str,
    max_requests: int = DEFAULT_MAX_REQUESTS,
    window_seconds: int = DEFAULT_WINDOW_SECONDS,
) -> Tuple[bool, int, int]:
    """
    Check and record a request for the given user.

    Returns:
        (allowed, remaining, retry_after_seconds)
        - allowed: True if the request is within limits
        - remaining: how many requests the user has left in this window
        - retry_after: seconds until the oldest entry expires (0 if allowed)
    """
    now = time.time()
    window_start = now - window_seconds
    key = f"ratelimit:{user_id}"

    pipe = redis_client.pipeline(transaction=True)

    # 1. Remove entries older than the window
    pipe.zremrangebyscore(key, 0, window_start)

    # 2. Count current entries
    pipe.zcard(key)

    # 3. Get the oldest entry (to compute Retry-After)
    pipe.zrange(key, 0, 0, withscores=True)

    results = pipe.execute()
    current_count = results[1]
    oldest_entries = results[2]

    if current_count >= max_requests:
        # Rate limited — compute retry_after
        if oldest_entries:
            oldest_score = oldest_entries[0][1]
            retry_after = int(oldest_score + window_seconds - now) + 1
        else:
            retry_after = window_seconds
        remaining = 0
        logger.warning(f"Rate limit exceeded for user {user_id}: {current_count}/{max_requests}")
        return False, remaining, retry_after

    # 4. Add this request
    pipe2 = redis_client.pipeline(transaction=True)
    pipe2.zadd(key, {f"{now}": now})
    pipe2.expire(key, window_seconds + 60)  # TTL slightly beyond window
    pipe2.execute()

    remaining = max_requests - current_count - 1
    logger.info(f"Rate limit OK for user {user_id}: {current_count + 1}/{max_requests} ({remaining} remaining)")
    return True, remaining, 0
