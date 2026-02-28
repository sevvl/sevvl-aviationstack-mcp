/**
 * Shared schemas for Aviationstack MCP tools.
 * - outputSchema: Structured response format (meta, items, raw)
 * - Prefix: aviationstack_ for all tool names
 */

/** JSON Schema for normalized success response */
export const AVIATIONSTACK_OUTPUT_SCHEMA_SUCCESS = {
    type: "object",
    description: "Normalized successful response from Aviationstack API",
    properties: {
        meta: {
            type: "object",
            description: "Response metadata",
            properties: {
                provider: { type: "string", const: "aviationstack" },
                resource: {
                    type: "string",
                    enum: ["flights", "airports", "airlines", "routes", "airplanes"],
                },
                page: { type: "number", description: "Current page" },
                per_page: { type: "number", description: "Items per page" },
                total: { type: "number", description: "Total count" },
            },
        },
        items: {
            type: "array",
            description: "Array of domain objects",
            items: { type: "object" },
        },
        raw: {
            type: "object",
            description: "Full provider payload",
        },
    },
    required: ["meta", "items", "raw"],
} as const;

/** JSON Schema for error response */
export const AVIATIONSTACK_OUTPUT_SCHEMA_ERROR = {
    type: "object",
    description: "Error response",
    properties: {
        error: {
            type: "object",
            properties: {
                provider: { type: "string" },
                code: { type: "string" },
                message: { type: "string" },
                status_code: { type: ["number", "null"] },
                retryable: { type: "boolean" },
                rate_limited: { type: "boolean" },
                retry_after_seconds: { type: ["number", "null"] },
            },
            required: ["provider", "message"],
        },
    },
    required: ["error"],
} as const;

/** Combined output schema (success or error) */
export const AVIATIONSTACK_OUTPUT_SCHEMA = {
    oneOf: [AVIATIONSTACK_OUTPUT_SCHEMA_SUCCESS, AVIATIONSTACK_OUTPUT_SCHEMA_ERROR],
} as const;

/** Tool names with aviationstack_ prefix */
export const TOOL_NAMES = {
    GET_FLIGHTS: "aviationstack_get_flights",
    GET_AIRPORTS: "aviationstack_get_airports",
    GET_AIRLINES: "aviationstack_get_airlines",
    GET_ROUTES: "aviationstack_get_routes",
    GET_AIRPLANES: "aviationstack_get_airplanes",
} as const;

export const ENDPOINT_MAP: Record<string, string> = {
    [TOOL_NAMES.GET_FLIGHTS]: "flights",
    [TOOL_NAMES.GET_AIRPORTS]: "airports",
    [TOOL_NAMES.GET_AIRLINES]: "airlines",
    [TOOL_NAMES.GET_ROUTES]: "routes",
    [TOOL_NAMES.GET_AIRPLANES]: "airplanes",
};
