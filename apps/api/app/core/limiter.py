from slowapi import Limiter

# Prefer request.client.host (set correctly by API Gateway / uvicorn).
# Fall back to the leftmost X-Forwarded-For entry only when client.host
# is unavailable (e.g. behind a non-standard proxy that strips it).
limiter = Limiter(
    key_func=lambda request: (
        (request.client.host if request.client else None)
        or request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or "unknown"
    )
)
