"""
In-memory fallback rate limiter and concurrency guard.

Activates when Redis is unreachable, providing two safety mechanisms:
  1. Sliding-window rate limiter per user (thread-safe)
  2. Concurrent job semaphore to prevent API flooding

This is intentionally MORE restrictive than the Redis-backed limiter
because we have no persistence — if the worker restarts, state is lost.
"""

import time
import threading
from typing import Tuple, Dict, List

# ── Configuration ─────────────────────────────────────────────────────────────
FALLBACK_MAX_REQUESTS = 3        # Lower than Redis limit (5) — conservative
FALLBACK_WINDOW_SECONDS = 3600   # 1 hour
MAX_CONCURRENT_JOBS = 3          # Max simultaneous BackgroundTask jobs

# ── State ─────────────────────────────────────────────────────────────────────
_lock = threading.Lock()
_request_log: Dict[str, List[float]] = {}  # user_id → [timestamp, ...]
_active_jobs = 0


# ── Rate Limiting ─────────────────────────────────────────────────────────────

def check_rate_limit(
    user_id: str,
    max_requests: int = FALLBACK_MAX_REQUESTS,
    window_seconds: int = FALLBACK_WINDOW_SECONDS,
) -> Tuple[bool, int, int]:
    """
    In-memory sliding-window rate limiter.

    Returns:
        (allowed, remaining, retry_after_seconds)

    Same API as rate_limiter.check_rate_limit() but without Redis.
    """
    now = time.time()
    window_start = now - window_seconds

    with _lock:
        # Get or create the request log for this user
        timestamps = _request_log.get(user_id, [])

        # Trim entries older than the window
        timestamps = [ts for ts in timestamps if ts > window_start]

        if len(timestamps) >= max_requests:
            # Rate limited
            oldest = timestamps[0] if timestamps else now
            retry_after = int(oldest + window_seconds - now) + 1
            _request_log[user_id] = timestamps
            return False, 0, retry_after

        # Allow the request
        timestamps.append(now)
        _request_log[user_id] = timestamps

        remaining = max_requests - len(timestamps)
        return True, remaining, 0


# ── Concurrent Job Guard ──────────────────────────────────────────────────────

def acquire_job_slot() -> bool:
    """
    Try to acquire a slot for a background job.
    Returns True if a slot is available, False if at capacity.
    """
    global _active_jobs
    with _lock:
        if _active_jobs >= MAX_CONCURRENT_JOBS:
            return False
        _active_jobs += 1
        return True


def release_job_slot():
    """Release a background job slot after completion."""
    global _active_jobs
    with _lock:
        _active_jobs = max(0, _active_jobs - 1)


def get_active_jobs() -> int:
    """Get the current number of active background jobs."""
    with _lock:
        return _active_jobs


# ── Cleanup ───────────────────────────────────────────────────────────────────

def cleanup_expired():
    """
    Remove expired entries from the in-memory log.
    Call periodically (e.g. every 5 minutes) to prevent memory growth.
    """
    now = time.time()
    cutoff = now - FALLBACK_WINDOW_SECONDS

    with _lock:
        expired_users = []
        for user_id, timestamps in _request_log.items():
            _request_log[user_id] = [ts for ts in timestamps if ts > cutoff]
            if not _request_log[user_id]:
                expired_users.append(user_id)

        for user_id in expired_users:
            del _request_log[user_id]
