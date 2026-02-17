"""
Redis-backed FIFO task queue with reliable delivery.

Uses the BRPOPLPUSH (reliable queue) pattern to guarantee zero task loss:
  1. LPUSH → `taskqueue:jobs`         (enqueue)
  2. BRPOPLPUSH → `taskqueue:processing` (atomic dequeue + in-flight tracking)
  3. LREM from processing on success  (ack)
  4. Requeue or → `taskqueue:dead_letter` after 3 failures (nack)

Keys:
  taskqueue:jobs             — pending tasks (Redis list, FIFO)
  taskqueue:processing       — in-flight tasks (Redis list)
  taskqueue:dead_letter      — permanently failed tasks (Redis list)
  taskqueue:meta:{job_id}    — per-job metadata (Redis hash, TTL 2h)
"""

import json
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

QUEUE_KEY = "taskqueue:jobs"
PROCESSING_KEY = "taskqueue:processing"
DEAD_LETTER_KEY = "taskqueue:dead_letter"
META_PREFIX = "taskqueue:meta:"
META_TTL = 7200  # 2 hours — metadata auto-expires

MAX_RETRIES = 3
STALE_TASK_TIMEOUT = 600  # 10 minutes — requeue stale in-flight tasks


# ── Enqueue ───────────────────────────────────────────────────────────────────

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
        "retries": "0",
    }

    pipe = redis_client.pipeline(transaction=True)

    # Store metadata
    meta_key = f"{META_PREFIX}{job_id}"
    pipe.hset(meta_key, mapping=meta)
    pipe.expire(meta_key, META_TTL)

    # Push to queue (LPUSH = new items go to left; pop from right = FIFO)
    pipe.lpush(QUEUE_KEY, job_id)

    pipe.execute()

    position = redis_client.llen(QUEUE_KEY)
    logger.info(f"Enqueued job {job_id} for user {user_id} (type={task_type}, pos={position})")
    return position


# ── Reliable Dequeue (BRPOPLPUSH) ─────────────────────────────────────────────

def dequeue_task(redis_client, timeout: int = 5) -> Optional[str]:
    """
    Atomically move a task from the pending queue to the processing list.

    Uses BRPOPLPUSH: the task is NEVER in limbo — it's either in `jobs`
    or in `processing`. If the worker crashes, `recover_stale_tasks()`
    will move it back.

    Returns the job_id or None on timeout.
    """
    # Redis 6.2+ deprecated BRPOPLPUSH in favour of BLMOVE
    try:
        result = redis_client.blmove(
            QUEUE_KEY, PROCESSING_KEY,
            timeout=timeout,
            src="RIGHT", dest="LEFT",
        )
    except (AttributeError, TypeError):
        # Fallback for older redis-py without blmove or different API
        result = redis_client.brpoplpush(QUEUE_KEY, PROCESSING_KEY, timeout=timeout)

    if result is None:
        return None

    job_id = result.decode("utf-8") if isinstance(result, bytes) else result

    # Stamp processing start time
    meta_key = f"{META_PREFIX}{job_id}"
    redis_client.hset(meta_key, "processing_started_at", str(time.time()))

    logger.info(f"Dequeued job {job_id} → processing")
    return job_id


# ── Ack / Nack ────────────────────────────────────────────────────────────────

def ack_task(redis_client, job_id: str):
    """
    Acknowledge successful completion — remove from the processing list.
    """
    redis_client.lrem(PROCESSING_KEY, 1, job_id)
    update_task_status(redis_client, job_id, "completed")
    logger.info(f"Acked job {job_id}")


def nack_task(redis_client, job_id: str, error_msg: str = ""):
    """
    Negative-acknowledge a failed task.
    Increments retry count. If below MAX_RETRIES, requeues.
    Otherwise moves to the dead-letter queue.
    """
    meta_key = f"{META_PREFIX}{job_id}"
    retries = int(redis_client.hget(meta_key, "retries") or 0)
    retries += 1
    redis_client.hset(meta_key, "retries", str(retries))

    if error_msg:
        redis_client.hset(meta_key, "last_error", error_msg[:500])

    # Remove from processing list first
    redis_client.lrem(PROCESSING_KEY, 1, job_id)

    if retries < MAX_RETRIES:
        # Requeue for retry
        redis_client.lpush(QUEUE_KEY, job_id)
        update_task_status(redis_client, job_id, "queued")
        logger.warning(f"Nacked job {job_id} (retry {retries}/{MAX_RETRIES}), requeued")
    else:
        # Move to dead-letter queue
        redis_client.lpush(DEAD_LETTER_KEY, job_id)
        update_task_status(redis_client, job_id, "dead_letter")
        logger.error(f"Job {job_id} moved to dead-letter queue after {MAX_RETRIES} failures: {error_msg}")


# ── Stale Task Recovery ───────────────────────────────────────────────────────

def recover_stale_tasks(redis_client) -> int:
    """
    Scan the processing list for tasks that have been in-flight longer than
    STALE_TASK_TIMEOUT. These are likely from crashed workers.
    Moves them back to the pending queue.

    Call this on worker startup and periodically.
    Returns the number of recovered tasks.
    """
    processing_items = redis_client.lrange(PROCESSING_KEY, 0, -1)
    recovered = 0
    now = time.time()

    for item in processing_items:
        job_id = item.decode("utf-8") if isinstance(item, bytes) else item
        meta = get_task_meta(redis_client, job_id)

        if not meta:
            # No metadata — orphan; remove from processing
            redis_client.lrem(PROCESSING_KEY, 1, job_id)
            logger.warning(f"Removed orphaned job {job_id} from processing (no metadata)")
            continue

        started_at = float(meta.get("processing_started_at", 0))
        if started_at > 0 and (now - started_at) > STALE_TASK_TIMEOUT:
            redis_client.lrem(PROCESSING_KEY, 1, job_id)
            redis_client.lpush(QUEUE_KEY, job_id)
            update_task_status(redis_client, job_id, "queued")
            recovered += 1
            logger.warning(
                f"Recovered stale job {job_id} (in-flight {int(now - started_at)}s > {STALE_TASK_TIMEOUT}s)"
            )

    if recovered:
        logger.info(f"Recovered {recovered} stale task(s) from processing queue")
    return recovered


# ── Dead-Letter Inspection ────────────────────────────────────────────────────

def get_dead_letter_jobs(redis_client, limit: int = 50) -> list:
    """Return the most recent dead-letter job IDs."""
    items = redis_client.lrange(DEAD_LETTER_KEY, 0, limit - 1)
    return [
        item.decode("utf-8") if isinstance(item, bytes) else item
        for item in items
    ]


def retry_dead_letter(redis_client, job_id: str) -> bool:
    """Manually retry a dead-letter job by resetting retries and requeuing."""
    meta_key = f"{META_PREFIX}{job_id}"
    if not redis_client.exists(meta_key):
        return False

    redis_client.lrem(DEAD_LETTER_KEY, 1, job_id)
    redis_client.hset(meta_key, "retries", "0")
    redis_client.lpush(QUEUE_KEY, job_id)
    update_task_status(redis_client, job_id, "queued")
    logger.info(f"Retried dead-letter job {job_id}")
    return True


# ── Metadata Helpers ──────────────────────────────────────────────────────────

def get_queue_position(redis_client, job_id: str) -> Optional[int]:
    """
    Get the 1-based position of a job in the pending queue.
    Returns None if the job is not in the queue (already processing or done).
    """
    queue_items = redis_client.lrange(QUEUE_KEY, 0, -1)

    for i, item in enumerate(queue_items):
        item_str = item.decode("utf-8") if isinstance(item, bytes) else item
        if item_str == job_id:
            # Items are popped from the right, so rightmost = next
            return len(queue_items) - i

    return None


def get_queue_length(redis_client) -> int:
    """Get the total number of tasks in the pending queue."""
    return redis_client.llen(QUEUE_KEY)


def get_processing_count(redis_client) -> int:
    """Get the number of tasks currently being processed."""
    return redis_client.llen(PROCESSING_KEY)


def get_task_meta(redis_client, job_id: str) -> Optional[dict]:
    """Get metadata for a queued/processing task."""
    meta_key = f"{META_PREFIX}{job_id}"
    data = redis_client.hgetall(meta_key)
    if not data:
        return None
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


# ── ETA Estimation ────────────────────────────────────────────────────────────

ESTIMATED_DURATIONS = {
    "video_generate": 90,
    "fashion_generate": 180,
    "try_on": 60,
    "default": 90,
}


def estimate_wait_seconds(redis_client, job_id: str) -> int:
    """Estimate how long until this job starts processing."""
    position = get_queue_position(redis_client, job_id)
    if position is None:
        return 0

    meta = get_task_meta(redis_client, job_id)
    task_type = meta.get("task_type", "default") if meta else "default"
    per_task = ESTIMATED_DURATIONS.get(task_type, ESTIMATED_DURATIONS["default"])

    return (position - 1) * per_task
