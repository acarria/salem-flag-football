from slowapi import Limiter

limiter = Limiter(
    key_func=lambda r: r.headers.get("X-Forwarded-For", r.client.host or "unknown").split(",")[0].strip()
)
