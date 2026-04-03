"""Domain-layer exceptions for service functions.

Services raise these instead of HTTPException. The router catches and maps:
    except ServiceError as e:
        raise HTTPException(e.status_code, e.detail)
"""


class ServiceError(Exception):
    """Base for all domain-layer errors. Carries an HTTP-equivalent status code."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class NotFoundError(ServiceError):
    def __init__(self, detail: str = "Not found"):
        super().__init__(detail, status_code=404)


class ConflictError(ServiceError):
    def __init__(self, detail: str):
        super().__init__(detail, status_code=409)


class ForbiddenError(ServiceError):
    def __init__(self, detail: str):
        super().__init__(detail, status_code=403)
