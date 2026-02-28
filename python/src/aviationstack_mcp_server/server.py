"""
Aviationstack MCP Server (Python)

MCP server providing aviation data via Aviationstack API.
- Tools: aviationstack_get_flights, aviationstack_get_airports, etc.
- Capabilities: tools, resources, prompts
- Output schema: meta, items, raw (structured response)
- API key: AVIATIONSTACK_API_KEY (env, never hardcoded)
"""

import asyncio
import json
from typing import Any, Dict, List

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.types import (
    Tool,
    TextContent,
    TextResourceContents,
    Resource,
    ResourceTemplate,
    Prompt,
    PromptArgument,
    GetPromptResult,
    PromptMessage,
)
import mcp.server.stdio

from .client import AviationstackAPIError, AviationstackClient
from .schemas import AVIATIONSTACK_OUTPUT_SCHEMA, ENDPOINT_MAP, TOOL_NAMES


server = Server("aviationstack-mcp-server")

_client: AviationstackClient | None = None


def get_client() -> AviationstackClient:
    global _client
    if _client is None:
        _client = AviationstackClient.from_env()
    return _client


def _create_tool(
    name: str,
    description: str,
    input_schema: Dict[str, Any],
) -> Tool:
    return Tool(
        name=name,
        description=description,
        inputSchema=input_schema,
        outputSchema=AVIATIONSTACK_OUTPUT_SCHEMA,
    )


@server.list_tools()
async def handle_list_tools() -> List[Tool]:
    return [
        _create_tool(
            TOOL_NAMES["GET_FLIGHTS"],
            "Get real-time and historical flight data.",
            {
                "type": "object",
                "properties": {
                    "flight_status": {
                        "type": "string",
                        "enum": [
                            "scheduled",
                            "active",
                            "landed",
                            "cancelled",
                            "incident",
                            "diverted",
                        ],
                    },
                    "flight_date": {
                        "type": "string",
                        "description": "Date in YYYY-MM-DD format",
                    },
                    "dep_iata": {"type": "string", "description": "Departure airport IATA code"},
                    "arr_iata": {"type": "string", "description": "Arrival airport IATA code"},
                    "airline_name": {"type": "string"},
                    "flight_number": {"type": "string"},
                },
            },
        ),
        _create_tool(
            TOOL_NAMES["GET_AIRPORTS"],
            "Search for global airports.",
            {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Search query"},
                    "iata_code": {"type": "string"},
                    "icao_code": {"type": "string"},
                    "country_name": {"type": "string"},
                },
            },
        ),
        _create_tool(
            TOOL_NAMES["GET_AIRLINES"],
            "Search for global airlines.",
            {
                "type": "object",
                "properties": {
                    "airline_name": {"type": "string"},
                    "iata_code": {"type": "string"},
                    "icao_code": {"type": "string"},
                },
            },
        ),
        _create_tool(
            TOOL_NAMES["GET_ROUTES"],
            "Get information about airline routes.",
            {
                "type": "object",
                "properties": {
                    "dep_iata": {"type": "string", "description": "Departure airport IATA code"},
                    "arr_iata": {"type": "string", "description": "Arrival airport IATA code"},
                    "airline_name": {"type": "string"},
                },
            },
        ),
        _create_tool(
            TOOL_NAMES["GET_AIRPLANES"],
            "Get information about specific aircraft.",
            {
                "type": "object",
                "properties": {
                    "registration_number": {"type": "string"},
                    "iata_type": {"type": "string"},
                },
            },
        ),
    ]


@server.list_resources()
async def handle_list_resources() -> List[Resource]:
    """List available MCP resources."""
    return [
        Resource(
            uri="aviationstack://docs",
            name="Aviationstack API Documentation",
            description="Complete documentation for Aviationstack MCP tools and usage",
            mimeType="text/plain",
        ),
        Resource(
            uri="aviationstack://endpoints", 
            name="Available Endpoints",
            description="List of all available Aviationstack API endpoints",
            mimeType="application/json",
        ),
    ]


@server.read_resource()
async def handle_read_resource(uri: str) -> str:
    """Read resource content."""
    if uri == "aviationstack://docs":
        return """# Aviationstack MCP Server Documentation

## Available Tools
- aviationstack_get_flights: Get real-time and historical flight data
- aviationstack_get_airports: Search for global airports  
- aviationstack_get_airlines: Search for global airlines
- aviationstack_get_routes: Get airline route information
- aviationstack_get_airplanes: Get aircraft information

## Response Format
All tools return structured responses:
- Success: { meta: { provider, resource, page... }, items: [...], raw: {...} }
- Error: { error: { provider, code, message, retryable... } }

## Environment Variables
- AVIATIONSTACK_API_KEY: Required API key from aviationstack.com
- AVIATIONSTACK_TIMEOUT_SECONDS: Request timeout (default: 10)
- AVIATIONSTACK_MAX_RETRIES: Max retry attempts (default: 2)
"""
    elif uri == "aviationstack://endpoints":
        return json.dumps({
            "endpoints": [
                {"name": "flights", "tool": "aviationstack_get_flights"},
                {"name": "airports", "tool": "aviationstack_get_airports"}, 
                {"name": "airlines", "tool": "aviationstack_get_airlines"},
                {"name": "routes", "tool": "aviationstack_get_routes"},
                {"name": "airplanes", "tool": "aviationstack_get_airplanes"}
            ]
        }, indent=2)
    else:
        raise ValueError(f"Unknown resource: {uri}")


@server.list_prompts()
async def handle_list_prompts() -> List[Prompt]:
    """List available MCP prompts."""
    return [
        Prompt(
            name="flight_search_helper",
            description="Help users search for flights using natural language",
            arguments=[
                PromptArgument(
                    name="query", 
                    description="Natural language flight search query",
                    required=True
                )
            ],
        ),
        Prompt(
            name="airport_lookup",
            description="Get airport information by IATA/ICAO code or name", 
            arguments=[
                PromptArgument(
                    name="airport_info",
                    description="Airport name, IATA code, or ICAO code",
                    required=True
                )
            ],
        ),
    ]


@server.get_prompt()
async def handle_get_prompt(name: str, arguments: Dict[str, str] | None) -> GetPromptResult:
    """Get prompt content."""
    if name == "flight_search_helper":
        query = arguments.get("query", "") if arguments else ""
        return GetPromptResult(
            description="Flight search helper prompt",
            messages=[
                PromptMessage(
                    role="user",
                    content={
                        "type": "text",
                        "text": f"""Help me search for flights with this query: "{query}"

Please use the aviationstack_get_flights tool with appropriate parameters:
- flight_date: Use YYYY-MM-DD format if date mentioned
- dep_iata: Departure airport IATA code if mentioned  
- arr_iata: Arrival airport IATA code if mentioned
- airline_name: Airline name if mentioned
- flight_number: Flight number if mentioned
- flight_status: Filter by status if mentioned (scheduled, active, landed, cancelled, incident, diverted)

Return the results in a clear, readable format."""
                    }
                )
            ]
        )
    elif name == "airport_lookup":
        airport_info = arguments.get("airport_info", "") if arguments else ""
        return GetPromptResult(
            description="Airport lookup prompt", 
            messages=[
                PromptMessage(
                    role="user",
                    content={
                        "type": "text",
                        "text": f"""Find information about this airport: "{airport_info}"

Please use the aviationstack_get_airports tool with appropriate parameters:
- search: General search term if airport name provided
- iata_code: IATA code if provided
- icao_code: ICAO code if provided  
- country_name: Country name if mentioned

Return detailed airport information including location, codes, and other available details."""
                    }
                )
            ]
        )
    else:
        raise ValueError(f"Unknown prompt: {name}")


@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any] | None) -> List[TextContent]:
    if not arguments:
        arguments = {}

    if name not in ENDPOINT_MAP:
        error = {
            "provider": "aviationstack",
            "code": "unknown_tool",
            "message": f"Unknown tool: {name}. Valid tools: {', '.join(ENDPOINT_MAP)}",
        }
        return [
            TextContent(type="text", text=json.dumps({"error": error}, ensure_ascii=False)),
        ]

    resource = ENDPOINT_MAP[name]

    try:
        client = get_client()
    except AviationstackAPIError as exc:
        return [
            TextContent(type="text", text=json.dumps({"error": exc.error}, ensure_ascii=False)),
        ]

    try:
        result = await client.fetch(resource, arguments)
        return [
            TextContent(
                type="text",
                text=json.dumps(result, ensure_ascii=False),
            )
        ]
    except AviationstackAPIError as exc:
        return [
            TextContent(
                type="text",
                text=json.dumps({"error": exc.error}, ensure_ascii=False),
            )
        ]
    except Exception as exc:
        error = {
            "provider": "aviationstack",
            "code": "unexpected_error",
            "message": f"Unexpected error in MCP server: {exc}",
        }
        return [
            TextContent(type="text", text=json.dumps({"error": error}, ensure_ascii=False)),
        ]


@server.list_resources()
async def handle_list_resources() -> List[Resource]:
    return [
        Resource(
            uri="aviationstack://docs",
            name="Aviationstack API Documentation",
            description="Overview of Aviationstack API endpoints and usage",
            mimeType="text/markdown",
        ),
    ]


@server.read_resource()
async def handle_read_resource(uri: Any) -> List[TextResourceContents]:
    uri_str = str(uri)
    if uri_str == "aviationstack://docs":
        docs = """# Aviationstack MCP API

## Tools (aviationstack_* prefix)
- `aviationstack_get_flights`: Flight data
- `aviationstack_get_airports`: Airport search
- `aviationstack_get_airlines`: Airline search
- `aviationstack_get_routes`: Route data
- `aviationstack_get_airplanes`: Aircraft info

## Response Format
All tools return: `{ meta, items, raw }` (success) or `{ error }` (failure).
"""
        return [
            TextResourceContents(
                uri=uri,
                text=docs,
                mimeType="text/markdown",
            ),
        ]
    raise ValueError(f"Unknown resource: {uri_str}")


@server.list_resource_templates()
async def handle_list_resource_templates() -> List[ResourceTemplate]:
    return []


@server.list_prompts()
async def handle_list_prompts() -> List[Prompt]:
    return [
        Prompt(
            name="aviationstack_flight_search",
            description="Search for flights by criteria",
            arguments=[
                PromptArgument(name="flight_number", description="Optional flight number (e.g. BA123)"),
                PromptArgument(name="dep_iata", description="Departure airport IATA code"),
                PromptArgument(name="arr_iata", description="Arrival airport IATA code"),
            ],
        ),
    ]


@server.get_prompt()
async def handle_get_prompt(name: str, arguments: Dict[str, str] | None) -> GetPromptResult:
    if not arguments:
        arguments = {}
    if name == "aviationstack_flight_search":
        flight_number = arguments.get("flight_number", "")
        dep_iata = arguments.get("dep_iata", "")
        arr_iata = arguments.get("arr_iata", "")
        parts = ["Search for flights"]
        if flight_number:
            parts.append(f"with flight number {flight_number}")
        if dep_iata:
            parts.append(f"departing from {dep_iata}")
        if arr_iata:
            parts.append(f"arriving at {arr_iata}")
        user_message = " ".join(parts)
        return GetPromptResult(
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(type="text", text=user_message),
                ),
            ],
        )
    raise ValueError(f"Unknown prompt: {name}")


async def main():
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="aviationstack-mcp-server",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    asyncio.run(main())
