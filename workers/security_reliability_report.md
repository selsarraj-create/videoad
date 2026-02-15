# Security & Reliability Report

## Redis Queue Infrastructure Audit

*Date: 2026-02-15 • Scope: `workers/` task queue subsystem*

---

## 1. Failure Mode Analysis

### Scenario A: Worker Crashes Mid-Processing

| Aspect | Before | After |
|--------|--------|-------|
| **Queue pattern** | `BRPOP` — task lost on crash | `BRPOPLPUSH` — task stays in `processing` list |
| **Recovery** | None — manual DB cleanup | `recover_stale_tasks()` on startup — auto-requeue after 10 min |
| **Data loss risk** | **HIGH** — any crash = lost task | **ZERO** — task is always in exactly one list |

### Scenario B: Redis Goes Down

| Aspect | Before | After |
|--------|--------|-------|
| **Rate limiting** | None — all requests pass | In-memory sliding window (3 req/hr/user) |
| **Concurrency** | Unlimited BackgroundTasks | Capped at 3 concurrent jobs via semaphore |
| **Behaviour** | Silent flood risk | Controlled degradation with 429/503 responses |

### Scenario C: Kie.ai Returns 429 / 5xx

| Aspect | Before | After |
|--------|--------|-------|
| **Retry** | None — immediate failure | Exponential backoff: 2^n × 2s + jitter, max 5 retries |
| **Queue interaction** | N/A | `nack_task()` → requeue (up to 3 attempts), then dead-letter |
| **Visibility** | Error buried in logs | `last_error` stored in task metadata, dead-letter queue for inspection |

### Scenario D: Task Keeps Failing (Poison Message)

| Aspect | Before | After |
|--------|--------|-------|
| **Behaviour** | Infinite retry or lost | 3 retries → dead-letter queue |
| **Recovery** | Manual | `retry_dead_letter(redis, job_id)` for manual re-attempt |
| **Monitoring** | None | `get_dead_letter_jobs()` returns failed job IDs with error info |

---

## 2. Architecture: Reliable Queue Pattern

```
                  LPUSH                    BRPOPLPUSH
  [Webhook] ──────────▶ taskqueue:jobs ──────────────▶ taskqueue:processing
                                                              │
                                          ┌───────────────────┼───────────────────┐
                                          │                   │                   │
                                       Success             Failure            Stale
                                          │                   │              (>10 min)
                                        LREM              retry < 3?          LREM +
                                          │               ┌───┴───┐           LPUSH
                                       (done)           Yes       No         (requeue)
                                                         │         │
                                                       LPUSH     LPUSH
                                                      (requeue) (dead_letter)
```

**Key guarantee**: A task is ALWAYS in exactly one location — `jobs`, `processing`, or `dead_letter`. It can never be lost.

---

## 3. Redis Persistence Configuration

| Strategy | Setting | Data Loss Window |
|----------|---------|-----------------|
| **AOF** | `appendfsync everysec` | ≤1 second |
| **RDB** | `save 60 1000` / `save 300 10` | Backup for fast restart |

> Railway's managed Redis has AOF enabled by default. The `redis.conf` is provided for documentation and self-hosted deployments.

---

## 4. Graceful Degradation (Redis Down)

When `get_redis()` returns `None`:

1. **Rate Limiting** → `fallback_limiter.check_rate_limit()` — in-memory sliding window
   - Conservative: 3 req/hr/user (vs 5 with Redis)
   - Thread-safe via `threading.Lock()`
   - State resets on worker restart (intentionally conservative)

2. **Concurrency Cap** → `fallback_limiter.acquire_job_slot()` — max 3 simultaneous BackgroundTasks
   - Rejects with 503 when at capacity
   - Slot released in `finally` block (guaranteed cleanup)

3. **Processing** → Direct `BackgroundTasks` (no queue persistence)

---

## 5. Files Modified

| File | Change |
|------|--------|
| `workers/redis.conf` | NEW — production Redis config |
| `workers/queue.py` | Rewritten — BRPOPLPUSH + ack/nack + dead-letter + recovery |
| `workers/fallback_limiter.py` | NEW — in-memory rate limiter + job semaphore |
| `workers/main.py` | Consumer: ack/nack; Startup: stale recovery; Webhooks: fallback limiter |

---

## 6. Recommendations

1. **Monitor dead-letter queue** — Set up a periodic check or admin endpoint for `get_dead_letter_jobs()`
2. **Redis Sentinel/Cluster** — For HA, consider Railway's Redis with replicas
3. **Metrics** — Add Prometheus counters for `tasks_enqueued`, `tasks_acked`, `tasks_nacked`, `tasks_dead_lettered`
4. **Cleanup cron** — Call `fallback_limiter.cleanup_expired()` every 5 minutes to prevent memory growth
