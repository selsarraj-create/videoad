"""
Shared-secret authentication middleware for the Railway worker.

All /webhook/* endpoints require a valid X-Worker-Secret header matching
the WORKER_SHARED_SECRET environment variable.  Vercel API routes attach
this header when forwarding requests to the worker.
"""

import os
import secrets
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

# Constant-time compare avoids timing attacks
WORKER_SECRET = os.environ.get("WORKER_SHARED_SECRET", "")


class WorkerAuthMiddleware(BaseHTTPMiddleware):
    """Reject unauthenticated requests to /webhook/* endpoints."""

    # Paths that are always public (health checks, etc.)
    PUBLIC_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip auth for public paths
        if path in self.PUBLIC_PATHS:
            return await call_next(request)

        # Skip auth for non-webhook paths (queue status, etc.)
        if not path.startswith("/webhook"):
            return await call_next(request)

        # Require WORKER_SHARED_SECRET to be configured
        if not WORKER_SECRET:
            # In development without the secret set, allow all traffic
            if os.environ.get("ENVIRONMENT", "development") == "development":
                return await call_next(request)
            raise HTTPException(status_code=500, detail="WORKER_SHARED_SECRET not configured")

        # Validate the secret header
        provided = request.headers.get("X-Worker-Secret", "")
        if not secrets.compare_digest(provided, WORKER_SECRET):
            raise HTTPException(status_code=401, detail="Invalid or missing worker secret")

        return await call_next(request)
