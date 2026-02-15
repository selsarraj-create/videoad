"""
Redis-backed FIFO task queue for video generation jobs.

Uses a Redis list for FIFO ordering and a hash for per-job metadata.
The worker runs a consumer loop that dequeues and processes tasks.

Queue key:  `taskqueue:jobs`         — Redis list (FIFO)
Meta key:   `taskqueue:meta:{job_id}` — Redis hash per job
"""

import json
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

QUEUE_KEY = "taskqueue:jobs"
META_PREFIX = "taskqueue:meta:"
META_TTL = 7200  # 2 hours — metadata auto-expires


def enqueue_task(
    redis_client,
    user_id: str,
    job_id: str,
    task_type: str,
    payload: dict,
) -> int:
    """
    Add a task to the back of the queue.

    Returns the queue position (1-based).
    """
    meta = {
        "user_id": user_id,
        "job_id": job_id,
        "task_type": task_type,
        "payload": json.dumps(payload),
        "enqueued_at": str(time.time()),
        "status": "queued",
    }

    pipe = redis_client.pipeline(transaction=True)

    # Store metadata
    meta_key = f"{META_PREFIX}{job_id}"
    pipe.hset(meta_key, mapping=meta)
    pipe.expire(meta_key, META_TTL)

    # Push to queue (LPUSH = new items go to left; BRPOP takes from right = FIFO)
    pipe.lpush(QUEUE_KEY, job_id)

    pipe.execute()

    position = redis_client.llen(QUEUE_KEY)
    logger.info(f"Enqueued job {job_id} for user {user_id} (type={task_type}, position={position})")
    return position


def get_queue_position(redis_client, job_id: str) -> Optional[int]:
    """
    Get the 1-based position of a job in the queue.
    Returns None if the job is not in the queue (already processing or done).
    """
    # LPOS returns 0-based index from left; our FIFO pops from right,
    # so position = length - index
    queue_items = redis_client.lrange(QUEUE_KEY, 0, -1)

    for i, item in enumerate(queue_items):
        item_str = item.decode("utf-8") if isinstance(item, bytes) else item
        if item_str == job_id:
            # Items are popped from the right (BRPOP), so rightmost = next
            # Position from right = len - i
            position = len(queue_items) - i
            return position

    return None


def get_queue_length(redis_client) -> int:
    """Get the total number of tasks in the queue."""
    return redis_client.llen(QUEUE_KEY)


def get_task_meta(redis_client, job_id: str) -> Optional[dict]:
    """Get metadata for a queued/processing task."""
    meta_key = f"{META_PREFIX}{job_id}"
    data = redis_client.hgetall(meta_key)
    if not data:
        return None
    # Decode bytes if needed
    result = {}
    for k, v in data.items():
        key = k.decode("utf-8") if isinstance(k, bytes) else k
        val = v.decode("utf-8") if isinstance(v, bytes) else v
        result[key] = val
    return result


def update_task_status(redis_client, job_id: str, status: str):
    """Update the status of a task in its metadata."""
    meta_key = f"{META_PREFIX}{job_id}"
    redis_client.hset(meta_key, "status", status)


def dequeue_task(redis_client, timeout: int = 5) -> Optional[str]:
    """
    Blocking dequeue — waits up to `timeout` seconds for a task.
    Returns the job_id or None if timeout.
    """
    result = redis_client.brpop(QUEUE_KEY, timeout=timeout)
    if result is None:
        return None
    _, job_id = result
    job_id_str = job_id.decode("utf-8") if isinstance(job_id, bytes) else job_id
    logger.info(f"Dequeued job {job_id_str}")
    return job_id_str


# Average processing time per task type (seconds) — used for ETA estimates
ESTIMATED_DURATIONS = {
    "video_generate": 90,
    "fashion_generate": 180,  # 3 Claid calls + Veo
    "try_on": 60,
    "default": 90,
}


def estimate_wait_seconds(redis_client, job_id: str) -> int:
    """Estimate how long until this job starts processing."""
    position = get_queue_position(redis_client, job_id)
    if position is None:
        return 0  # Already processing or done

    meta = get_task_meta(redis_client, job_id)
    task_type = meta.get("task_type", "default") if meta else "default"
    per_task = ESTIMATED_DURATIONS.get(task_type, ESTIMATED_DURATIONS["default"])

    return (position - 1) * per_task
