"""Simple in-process rate limiter for auth endpoints (per EB instance)."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

# key -> deque of monotonic timestamps
_HITS: dict[str, deque[float]] = defaultdict(deque)


def rate_limit(request: Request, *, key: str, limit: int, window_seconds: int) -> None:
    """Raise 429 when `key` exceeds `limit` hits inside `window_seconds`."""
    now = time.monotonic()
    bucket_key = f"{key}:{_client_ip(request)}"
    q = _HITS[bucket_key]
    cutoff = now - window_seconds
    while q and q[0] < cutoff:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    q.append(now)


def _client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
