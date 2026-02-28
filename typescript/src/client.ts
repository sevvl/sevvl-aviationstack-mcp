import axios, { AxiosError } from "axios";

export interface AviationstackMeta {
    provider: "aviationstack";
    resource: string;
    page?: number | null;
    per_page?: number | null;
    total?: number | null;
}

export interface AviationstackSuccess {
    meta: AviationstackMeta;
    items: Array<Record<string, unknown>>;
    raw: Record<string, unknown>;
}

export interface AviationstackErrorPayload {
    provider: "aviationstack";
    code?: string | null;
    message: string;
    status_code?: number | null;
    retryable: boolean;
    rate_limited: boolean;
    retry_after_seconds?: number | null;
}

export class AviationstackAPIError extends Error {
    public readonly error: AviationstackErrorPayload;

    constructor(error: AviationstackErrorPayload) {
        super(error.message);
        this.name = "AviationstackAPIError";
        this.error = error;
    }
}

const DEFAULT_BASE_URL =
    process.env.AVIATIONSTACK_BASE_URL ?? "http://api.aviationstack.com/v1/";

const DEFAULT_TIMEOUT_SECONDS = Number(
    process.env.AVIATIONSTACK_TIMEOUT_SECONDS ?? "10",
);

const DEFAULT_MAX_RETRIES = Number(
    process.env.AVIATIONSTACK_MAX_RETRIES ?? "2",
);

const DEFAULT_BACKOFF_SECONDS = Number(
    process.env.AVIATIONSTACK_RETRY_BACKOFF_SECONDS ?? "0.5",
);

export class AviationstackClient {
    constructor(
        private readonly apiKey: string,
        private readonly baseUrl: string = DEFAULT_BASE_URL,
        private readonly timeoutSeconds: number = DEFAULT_TIMEOUT_SECONDS,
        private readonly maxRetries: number = DEFAULT_MAX_RETRIES,
        private readonly backoffSeconds: number = DEFAULT_BACKOFF_SECONDS,
    ) {}

    static fromEnv(): AviationstackClient {
        const apiKey = process.env.AVIATIONSTACK_API_KEY;
        if (!apiKey) {
            throw new AviationstackAPIError({
                provider: "aviationstack",
                code: "missing_api_key",
                message: "AVIATIONSTACK_API_KEY environment variable is not set",
                status_code: null,
                retryable: false,
                rate_limited: false,
                retry_after_seconds: null,
            });
        }

        return new AviationstackClient(apiKey);
    }

    async fetch(
        resource: string,
        params: Record<string, unknown> = {},
    ): Promise<AviationstackSuccess> {
        const requestParams = {
            ...params,
            access_key: this.apiKey,
        };

        let attempt = 0;
        let lastError: AviationstackErrorPayload | null = null;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                const response = await axios.get(`${this.baseUrl}${resource}`, {
                    params: requestParams,
                    timeout: this.timeoutSeconds * 1000,
                    validateStatus: () => true,
                });

                const { status, data } = response;

                if (status >= 400) {
                    const error = this.buildErrorFromHttpStatus(status, data, response.headers);
                    throw new AviationstackAPIError(error);
                }

                if (data && typeof data === "object" && "error" in data) {
                    const error = this.buildApiErrorFromBody(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (data as any).error ?? {},
                        status,
                    );
                    throw new AviationstackAPIError(error);
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return this.normalizeSuccess(resource, data as any);
            } catch (err) {
                const { error, retryable } = this.mapError(err, attempt);
                lastError = error;

                if (!retryable || !this.shouldRetry(error, attempt)) {
                    throw new AviationstackAPIError(error);
                }

                attempt += 1;
                if (attempt > this.maxRetries) {
                    const terminalError: AviationstackErrorPayload = {
                        provider: "aviationstack",
                        code: "max_retries_exceeded",
                        message:
                            lastError?.message ??
                            "Maximum retry attempts exceeded while calling Aviationstack",
                        status_code: lastError?.status_code ?? null,
                        retryable: false,
                        rate_limited: lastError?.rate_limited ?? false,
                        retry_after_seconds: lastError?.retry_after_seconds ?? null,
                    };
                    throw new AviationstackAPIError(terminalError);
                }

                const sleepForSeconds =
                    this.backoffSeconds * Math.pow(2, Math.max(0, attempt - 1));
                await this.sleep(sleepForSeconds);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private normalizeSuccess(resource: string, data: any): AviationstackSuccess {
        const itemsRaw = data?.data ?? [];
        const items = Array.isArray(itemsRaw) ? itemsRaw : [itemsRaw];
        const pagination = data?.pagination ?? {};

        const meta: AviationstackMeta = {
            provider: "aviationstack",
            resource,
            page: pagination.current_page ?? null,
            per_page: pagination.limit ?? null,
            total: pagination.total ?? null,
        };

        return {
            meta,
            items,
            raw: data ?? {},
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private buildApiErrorFromBody(
        bodyError: any,
        statusCode: number | null,
    ): AviationstackErrorPayload {
        const message =
            typeof bodyError?.message === "string"
                ? bodyError.message
                : "Aviationstack reported an error";
        const code = bodyError?.code;

        const lowerMessage = String(message).toLowerCase();
        const lowerCode = String(code ?? "").toLowerCase();
        const rateLimited =
            lowerCode.includes("rate_limit") ||
            lowerCode.includes("quota") ||
            lowerMessage.includes("rate limit") ||
            lowerMessage.includes("quota");

        return {
            provider: "aviationstack",
            code: code != null ? String(code) : null,
            message,
            status_code: statusCode,
            retryable: rateLimited,
            rate_limited: rateLimited,
            retry_after_seconds: null,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private buildErrorFromHttpStatus(
        status: number,
        body: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headers: any,
    ): AviationstackErrorPayload {
        let message = `HTTP ${status} from Aviationstack`;
        let code: string | null = null;
        let rateLimited = status === 429;
        let retryAfterSeconds: number | null = null;

        try {
            const errorFromBody = body?.error;
            if (errorFromBody && typeof errorFromBody === "object") {
                if (typeof errorFromBody.message === "string") {
                    message = errorFromBody.message;
                }
                if (errorFromBody.code != null) {
                    code = String(errorFromBody.code);
                }
            }
        } catch {
            // Ignore JSON structure issues.
        }

        if (rateLimited && headers) {
            const retryAfterHeader =
                headers["retry-after"] ?? headers["Retry-After"];
            if (retryAfterHeader != null) {
                const parsed = Number(retryAfterHeader);
                if (!Number.isNaN(parsed)) {
                    retryAfterSeconds = parsed;
                }
            }
        }

        const retryable = rateLimited || (status >= 500 && status < 600);

        return {
            provider: "aviationstack",
            code,
            message,
            status_code: status,
            retryable,
            rate_limited: rateLimited,
            retry_after_seconds: retryAfterSeconds,
        };
    }

    private mapError(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        err: any,
        attempt: number,
    ): { error: AviationstackErrorPayload; retryable: boolean } {
        if (err instanceof AviationstackAPIError) {
            return { error: err.error, retryable: err.error.retryable };
        }

        if (axios.isAxiosError(err)) {
            const axiosErr = err as AxiosError;

            if (axiosErr.response) {
                const { status, data, headers } = axiosErr.response;
                const error = this.buildErrorFromHttpStatus(
                    status ?? 0,
                    data,
                    headers,
                );
                return { error, retryable: error.retryable };
            }

            const networkError: AviationstackErrorPayload = {
                provider: "aviationstack",
                code: "network_error",
                message: `Network error while calling Aviationstack: ${axiosErr.message}`,
                status_code: null,
                retryable: true,
                rate_limited: false,
                retry_after_seconds: null,
            };

            return { error: networkError, retryable: true };
        }

        const genericError: AviationstackErrorPayload = {
            provider: "aviationstack",
            code: "unexpected_error",
            message: `Unexpected error while calling Aviationstack: ${String(
                err,
            )}`,
            status_code: null,
            retryable: attempt < this.maxRetries,
            rate_limited: false,
            retry_after_seconds: null,
        };

        return { error: genericError, retryable: genericError.retryable };
    }

    private shouldRetry(
        error: AviationstackErrorPayload,
        attempt: number,
    ): boolean {
        if (attempt >= this.maxRetries) {
            return false;
        }

        if (error.rate_limited) {
            return true;
        }

        return Boolean(error.retryable);
    }

    private async sleep(seconds: number): Promise<void> {
        const ms = Math.max(0, seconds) * 1000;
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}

