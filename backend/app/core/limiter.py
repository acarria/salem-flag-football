from slowapi import Limiter

# Use the leftmost IP in X-Forwarded-For (the original client IP as appended by
# each proxy hop). This prevents spoofing via injected rightmost values. Assumes
# the load balancer/proxy appends rather than overwrites the header.
limiter = Limiter(
    key_func=lambda request: (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )
)
