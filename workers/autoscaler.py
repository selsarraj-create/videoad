"""
Queue-depth autoscaler endpoint.

Returns the desired replica count based on current Redis queue depth.
Railway or an external orchestrator polls /autoscale and adjusts replicas.

Formula:
    desired = ceil(queue_depth / TARGET_PER_REPLICA)
    desired = clamp(desired, MIN_REPLICAS, MAX_REPLICAS)
"""

import math
import os
from . import queue as task_queue

# ── Configuration (matches scaling_manifest.yaml) ────────────────────────────
MIN_REPLICAS = int(os.environ.get("AUTOSCALE_MIN_REPLICAS", "1"))
MAX_REPLICAS = int(os.environ.get("AUTOSCALE_MAX_REPLICAS", "8"))
TARGET_PER_REPLICA = int(os.environ.get("AUTOSCALE_TARGET_PER_REPLICA", "5"))


def get_scaling_decision(redis_client) -> dict:
    """
    Compute the desired replica count from current queue state.

    Returns a dict suitable for JSON response:
        {
            "desired_replicas": int,
            "queue_depth": int,
            "processing_count": int,
            "target_per_replica": int,
            "reason": str,
        }
    """
    queue_depth = 0
    processing_count = 0

    if redis_client:
        try:
            queue_depth = task_queue.get_queue_length(redis_client)
            processing_count = task_queue.get_processing_count(redis_client)
        except Exception:
            pass

    total_load = queue_depth + processing_count
    desired = math.ceil(total_load / TARGET_PER_REPLICA) if total_load > 0 else MIN_REPLICAS
    desired = max(MIN_REPLICAS, min(MAX_REPLICAS, desired))

    if total_load == 0:
        reason = "idle"
    elif desired == MAX_REPLICAS:
        reason = f"at_max — load={total_load}"
    elif desired > 1:
        reason = f"scaling_up — load={total_load}, {TARGET_PER_REPLICA}/replica"
    else:
        reason = f"nominal — load={total_load}"

    return {
        "desired_replicas": desired,
        "queue_depth": queue_depth,
        "processing_count": processing_count,
        "total_load": total_load,
        "target_per_replica": TARGET_PER_REPLICA,
        "min_replicas": MIN_REPLICAS,
        "max_replicas": MAX_REPLICAS,
        "reason": reason,
    }
