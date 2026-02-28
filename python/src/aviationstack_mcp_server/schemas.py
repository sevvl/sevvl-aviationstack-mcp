"""
Shared schemas for Aviationstack MCP tools.
- outputSchema: Structured response format (meta, items, raw)
- Prefix: aviationstack_ for all tool names
"""

AVIATIONSTACK_OUTPUT_SCHEMA = {
    "oneOf": [
        {
            "type": "object",
            "description": "Normalized successful response from Aviationstack API",
            "properties": {
                "meta": {
                    "type": "object",
                    "properties": {
                        "provider": {"type": "string", "const": "aviationstack"},
                        "resource": {
                            "type": "string",
                            "enum": ["flights", "airports", "airlines", "routes", "airplanes"],
                        },
                        "page": {"type": "number"},
                        "per_page": {"type": "number"},
                        "total": {"type": "number"},
                    },
                },
                "items": {"type": "array", "items": {"type": "object"}},
                "raw": {"type": "object"},
            },
            "required": ["meta", "items", "raw"],
        },
        {
            "type": "object",
            "description": "Error response",
            "properties": {
                "error": {
                    "type": "object",
                    "properties": {
                        "provider": {"type": "string"},
                        "code": {"type": "string"},
                        "message": {"type": "string"},
                        "status_code": {"type": ["number", "null"]},
                        "retryable": {"type": "boolean"},
                        "rate_limited": {"type": "boolean"},
                        "retry_after_seconds": {"type": ["number", "null"]},
                    },
                    "required": ["provider", "message"],
                },
            },
            "required": ["error"],
        },
    ],
}

TOOL_NAMES = {
    "GET_FLIGHTS": "aviationstack_get_flights",
    "GET_AIRPORTS": "aviationstack_get_airports",
    "GET_AIRLINES": "aviationstack_get_airlines",
    "GET_ROUTES": "aviationstack_get_routes",
    "GET_AIRPLANES": "aviationstack_get_airplanes",
}

ENDPOINT_MAP = {
    TOOL_NAMES["GET_FLIGHTS"]: "flights",
    TOOL_NAMES["GET_AIRPORTS"]: "airports",
    TOOL_NAMES["GET_AIRLINES"]: "airlines",
    TOOL_NAMES["GET_ROUTES"]: "routes",
    TOOL_NAMES["GET_AIRPLANES"]: "airplanes",
}
