"""Custom middleware for the FastAPI application."""

import contextvars
import re
import uuid
from starlette.middleware.base import BaseHTTPMiddleware

# Contextvar for correlation ID — accessible from any service/handler without
# passing the request object through the call stack.
correlation_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("correlation_id", default="")

CORRELATION_HEADER = "X-Correlation-ID"

# Valid correlation IDs: alphanumeric, hyphens, underscores, dots; max 128 chars
_CORRELATION_ID_RE = re.compile(r"^[a-zA-Z0-9\-_.]+$")
_CORRELATION_ID_MAX_LEN = 128


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Generates or propagates a correlation ID for request tracing.

    If the incoming request includes a valid X-Correlation-ID header, it is reused.
    Otherwise a new UUID is generated. The ID is stored in request.state and
    returned in the response header.
    """

    async def dispatch(self, request, call_next):
        raw = request.headers.get(CORRELATION_HEADER)
        if raw and len(raw) <= _CORRELATION_ID_MAX_LEN and _CORRELATION_ID_RE.fullmatch(raw):
            correlation_id = raw
        else:
            correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        token = correlation_id_var.set(correlation_id)
        try:
            response = await call_next(request)
            response.headers[CORRELATION_HEADER] = correlation_id
            return response
        finally:
            correlation_id_var.reset(token)
