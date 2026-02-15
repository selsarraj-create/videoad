"""
Thread-safe in-memory metrics collector for the worker.

Tracks the Four Golden Signals + business metrics:
  - Latency: request duration histograms
  - Traffic: request counters by endpoint
  - Errors: failure counters by type
  - Saturation: active jobs, queue depth

All data is ephemeral (resets on restart). For persistent metrics,
the frontend enriches with Supabase job history.
"""

import time
import threading
from typing import Dict, List
from collections import defaultdict

_lock = threading.Lock()

# ── Counters ──────────────────────────────────────────────────────────────────
_counters: Dict[str, int] = defaultdict(int)

# ── Latency samples (last 100 per endpoint) ──────────────────────────────────
_latency_samples: Dict[str, List[float]] = defaultdict(list)
MAX_SAMPLES = 100

# ── Time-series (per-minute buckets, last 60 minutes) ─────────────────────────
_timeseries: Dict[str, Dict[int, int]] = defaultdict(lambda: defaultdict(int))
MAX_MINUTES = 60

# ── Gauges ────────────────────────────────────────────────────────────────────
_gauges: Dict[str, float] = defaultdict(float)

# ── Error log (last 50 errors for RCA) ────────────────────────────────────────
_recent_errors: List[dict] = []
MAX_ERRORS = 50


def _minute_bucket() -> int:
    """Current minute as unix timestamp (floored)."""
    return int(time.time()) // 60 * 60


# ── Public API ────────────────────────────────────────────────────────────────

def inc_counter(name: str, amount: int = 1):
    """Increment a counter (e.g. 'requests.generate', 'errors.kie_429')."""
    with _lock:
        _counters[name] += amount
        _timeseries[name][_minute_bucket()] += amount


def record_latency(endpoint: str, duration_ms: float):
    """Record a latency sample in milliseconds."""
    with _lock:
        samples = _latency_samples[endpoint]
        samples.append(duration_ms)
        if len(samples) > MAX_SAMPLES:
            _latency_samples[endpoint] = samples[-MAX_SAMPLES:]


def set_gauge(name: str, value: float):
    """Set a gauge value (e.g. 'queue_depth', 'active_jobs')."""
    with _lock:
        _gauges[name] = value


def record_error(endpoint: str, error_type: str, message: str, user_id: str = ""):
    """Record an error for root-cause analysis."""
    with _lock:
        _recent_errors.append({
            "timestamp": time.time(),
            "endpoint": endpoint,
            "error_type": error_type,
            "message": message[:300],
            "user_id": user_id,
        })
        if len(_recent_errors) > MAX_ERRORS:
            _recent_errors.pop(0)


def get_snapshot() -> dict:
    """
    Return a complete metrics snapshot for the /metrics endpoint.
    Thread-safe read of all collected data.
    """
    now = time.time()
    minute_now = int(now) // 60 * 60

    with _lock:
        # Compute latency percentiles
        latency_stats = {}
        for endpoint, samples in _latency_samples.items():
            if not samples:
                continue
            sorted_s = sorted(samples)
            n = len(sorted_s)
            latency_stats[endpoint] = {
                "p50": sorted_s[n // 2],
                "p95": sorted_s[int(n * 0.95)] if n >= 20 else sorted_s[-1],
                "p99": sorted_s[int(n * 0.99)] if n >= 100 else sorted_s[-1],
                "avg": sum(sorted_s) / n,
                "count": n,
            }

        # Build time-series (last 60 minutes)
        timeseries_out = {}
        for metric_name, buckets in _timeseries.items():
            series = []
            for i in range(MAX_MINUTES):
                bucket_time = minute_now - (MAX_MINUTES - 1 - i) * 60
                series.append({
                    "t": bucket_time,
                    "v": buckets.get(bucket_time, 0),
                })
            timeseries_out[metric_name] = series

            # Cleanup old buckets
            cutoff = minute_now - MAX_MINUTES * 60
            expired = [k for k in buckets if k < cutoff]
            for k in expired:
                del buckets[k]

        # Error pattern analysis
        error_patterns: Dict[str, int] = defaultdict(int)
        for err in _recent_errors:
            pattern_key = f"{err['endpoint']}:{err['error_type']}"
            error_patterns[pattern_key] += 1

        # Compute error rate (last 5 minutes)
        recent_cutoff = minute_now - 5 * 60
        recent_requests = 0
        recent_errors = 0
        for metric_name, buckets in _timeseries.items():
            for bucket_time, count in buckets.items():
                if bucket_time >= recent_cutoff:
                    if metric_name.startswith("requests."):
                        recent_requests += count
                    elif metric_name.startswith("errors."):
                        recent_errors += count

        error_rate = (recent_errors / recent_requests * 100) if recent_requests > 0 else 0

        return {
            "timestamp": now,
            "counters": dict(_counters),
            "gauges": dict(_gauges),
            "latency": latency_stats,
            "timeseries": timeseries_out,
            "error_rate_5m": round(error_rate, 2),
            "recent_errors": list(_recent_errors[-10:]),  # Last 10 for display
            "error_patterns": dict(error_patterns),
            "uptime_seconds": now - _gauges.get("start_time", now),
        }
