import asyncio
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TypedDict, Literal

import httpx


class AviationstackMeta(TypedDict, total=False):
    """Metadata about a result set, in a provider-agnostic shape."""

    provider: Literal["aviationstack"]
    resource: str
    page: Optional[int]
    per_page: Optional[int]
    total: Optional[int]


class AviationstackSuccess(TypedDict):
    """Normalized successful payload returned from the Aviationstack API."""

    meta: AviationstackMeta
    items: List[Dict[str, Any]]
    raw: Dict[str, Any]


class AviationstackErrorPayload(TypedDict, total=False):
    """Structured error information we can surface to MCP clients."""

    provider: Literal["aviationstack"]
    code: Optional[str]
    message: str
    status_code: Optional[int]
    retryable: bool
    rate_limited: bool
    retry_after_seconds: Optional[float]


class AviationstackAPIError(Exception):
    """Exception raised when the Aviationstack API returns an error."""

    def __init__(self, error: AviationstackErrorPayload) -> None:
        self.error = error
        super().__init__(error.get("message", "Aviationstack API error"))


DEFAULT_BASE_URL = os.getenv("AVIATIONSTACK_BASE_URL", "http://api.aviationstack.com/v1/")
DEFAULT_TIMEOUT = float(os.getenv("AVIATIONSTACK_TIMEOUT_SECONDS", "10"))
DEFAULT_MAX_RETRIES = int(os.getenv("AVIATIONSTACK_MAX_RETRIES", "2"))
DEFAULT_BACKOFF_SECONDS = float(os.getenv("AVIATIONSTACK_RETRY_BACKOFF_SECONDS", "0.5"))


@dataclass(slots=True)
class AviationstackClient:
    """Thin asynchronous client with retry, timeout and error mapping."""

    api_key: str
    base_url: str = DEFAULT_BASE_URL
    timeout: float = DEFAULT_TIMEOUT
    max_retries: int = DEFAULT_MAX_RETRIES
    backoff_seconds: float = DEFAULT_BACKOFF_SECONDS

    @classmethod
    def from_env(cls) -> "AviationstackClient":
        api_key = os.getenv("AVIATIONSTACK_API_KEY")
        if not api_key:
            raise AviationstackAPIError(
                {
                    "provider": "aviationstack",
                    "code": "missing_api_key",
                    "message": "AVIATIONSTACK_API_KEY environment variable is not set",
                    "status_code": None,
                    "retryable": False,
                    "rate_limited": False,
                    "retry_after_seconds": None,
                }
            )

        return cls(api_key=api_key)

    async def fetch(
        self,
        resource: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> AviationstackSuccess:
        """
        Fetch data from a named Aviationstack resource (e.g. ``flights``).

        Applies simple exponential backoff for transient and rate limit errors.
        """

        if params is None:
            params = {}

        # Ensure we never mutate the caller's dict.
        request_params = dict(params)
        request_params["access_key"] = self.api_key

        attempt = 0
        last_error: Optional[AviationstackErrorPayload] = None

        while True:
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(f"{self.base_url}{resource}", params=request_params)
                    response.raise_for_status()

                data = response.json()

                if isinstance(data, dict) and data.get("error"):
                    # Aviationstack embeds errors inside a 200 payload in some cases.
                    raise self._build_api_error_from_body(
                        data["error"],
                        status_code=response.status_code,
                    )

                return self._normalize_success(resource, data)

            except AviationstackAPIError as exc:
                # Already normalized; decide whether to retry.
                if not self._should_retry(exc.error, attempt):
                    raise

                last_error = exc.error
            except httpx.HTTPStatusError as exc:
                error = self._build_error_from_http_status(exc)
                if not self._should_retry(error, attempt):
                    raise AviationstackAPIError(error)
                last_error = error
            except (httpx.RequestError, asyncio.TimeoutError) as exc:
                error: AviationstackErrorPayload = {
                    "provider": "aviationstack",
                    "code": "network_error",
                    "message": f"Network error while calling Aviationstack: {exc}",
                    "status_code": None,
                    "retryable": True,
                    "rate_limited": False,
                    "retry_after_seconds": None,
                }
                if not self._should_retry(error, attempt):
                    raise AviationstackAPIError(error)
                last_error = error

            # If we got here, we're going to retry if attempts remain.
            attempt += 1
            if attempt > self.max_retries:
                # Safety check; should already have returned above.
                if last_error is None:
                    last_error = {
                        "provider": "aviationstack",
                        "code": "max_retries_exceeded",
                        "message": "Maximum retry attempts exceeded while calling Aviationstack",
                        "status_code": None,
                        "retryable": False,
                        "rate_limited": False,
                        "retry_after_seconds": None,
                    }
                raise AviationstackAPIError(last_error)

            # Basic exponential backoff.
            sleep_for = self.backoff_seconds * (2 ** (attempt - 1))
            await asyncio.sleep(sleep_for)

    @staticmethod
    def _normalize_success(resource: str, data: Dict[str, Any]) -> AviationstackSuccess:
        """
        Map the raw Aviationstack shape into a stable internal schema.

        This keeps MCP-facing code insulated from provider quirks.
        """

        items = data.get("data") or []
        if not isinstance(items, list):
            # Defensive: some endpoints might not be list-shaped.
            items = [items]

        pagination = data.get("pagination") or {}

        meta: AviationstackMeta = {
            "provider": "aviationstack",
            "resource": resource,
            "page": pagination.get("current_page"),
            "per_page": pagination.get("limit"),
            "total": pagination.get("total"),
        }

        return {
            "meta": meta,
            "items": items,
            "raw": data,
        }

    @staticmethod
    def _build_api_error_from_body(
        body_error: Dict[str, Any],
        status_code: Optional[int],
    ) -> AviationstackAPIError:
        message = body_error.get("message") or "Aviationstack reported an error"
        code = body_error.get("code")

        rate_limited = str(code).lower() in {"rate_limit", "quota_reached"} or "rate limit" in str(message).lower()

        payload: AviationstackErrorPayload = {
            "provider": "aviationstack",
            "code": str(code) if code is not None else None,
            "message": message,
            "status_code": status_code,
            "retryable": rate_limited,
            "rate_limited": rate_limited,
            "retry_after_seconds": None,
        }
        return AviationstackAPIError(payload)

    @staticmethod
    def _build_error_from_http_status(exc: httpx.HTTPStatusError) -> AviationstackErrorPayload:
        status = exc.response.status_code
        message = f"HTTP {status} from Aviationstack"
        body_error: Optional[Dict[str, Any]] = None

        try:
            payload = exc.response.json()
            if isinstance(payload, dict) and "error" in payload:
                body_error = payload["error"]
                message = body_error.get("message", message)
        except Exception:
            # Ignore JSON parsing issues; we still have status code.
            pass

        rate_limited = status == 429
        retry_after: Optional[float] = None

        if rate_limited:
            header_value = exc.response.headers.get("Retry-After")
            if header_value is not None:
                try:
                    retry_after = float(header_value)
                except ValueError:
                    retry_after = None

        code = None
        if body_error is not None:
            code = body_error.get("code")

        return {
            "provider": "aviationstack",
            "code": str(code) if code is not None else None,
            "message": message,
            "status_code": status,
            "retryable": rate_limited or 500 <= status < 600,
            "rate_limited": rate_limited,
            "retry_after_seconds": retry_after,
        }

    def _should_retry(self, error: AviationstackErrorPayload, attempt: int) -> bool:
        """Decide whether to retry a call based on the error payload."""

        if attempt >= self.max_retries:
            return False

        if error.get("rate_limited"):
            return True

        return bool(error.get("retryable"))

