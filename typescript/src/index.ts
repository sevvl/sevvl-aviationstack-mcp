/**
 * Aviationstack MCP Server (TypeScript)
 *
 * MCP server providing aviation data via Aviationstack API.
 * - Tools: aviationstack_get_flights, aviationstack_get_airports, etc.
 * - Capabilities: tools, resources, prompts
 * - Output schema: meta, items, raw (structured response)
 * - API key: AVIATIONSTACK_API_KEY (env, never hardcoded)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import {
    AviationstackAPIError,
    AviationstackClient,
    AviationstackErrorPayload,
} from "./client.js";
import {
    AVIATIONSTACK_OUTPUT_SCHEMA,
    ENDPOINT_MAP,
    TOOL_NAMES,
} from "./schemas.js";

dotenv.config();

export const server = new Server(
    {
        name: "aviationstack-mcp-server",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
            resources: {},
            prompts: {},
        },
    }
);

let client: AviationstackClient | null = null;

const getClient = (): AviationstackClient => {
    if (!client) {
        client = AviationstackClient.fromEnv();
    }
    return client;
};

/** Standard error payload for consistent error handling */
function createErrorPayload(
    code: string,
    message: string,
    extras: Partial<AviationstackErrorPayload> = {}
): AviationstackErrorPayload {
    return {
        provider: "aviationstack",
        code,
        message,
        status_code: null,
        retryable: false,
        rate_limited: false,
        retry_after_seconds: null,
        ...extras,
    };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: TOOL_NAMES.GET_FLIGHTS,
                description: "Get real-time and historical flight data.",
                inputSchema: {
                    type: "object",
                    properties: {
                        flight_status: {
                            type: "string",
                            enum: [
                                "scheduled",
                                "active",
                                "landed",
                                "cancelled",
                                "incident",
                                "diverted",
                            ],
                        },
                        flight_date: {
                            type: "string",
                            description: "Date in YYYY-MM-DD format",
                        },
                        dep_iata: {
                            type: "string",
                            description: "Departure airport IATA code",
                        },
                        arr_iata: {
                            type: "string",
                            description: "Arrival airport IATA code",
                        },
                        airline_name: { type: "string" },
                        flight_number: { type: "string" },
                    },
                },
                outputSchema: AVIATIONSTACK_OUTPUT_SCHEMA,
            },
            {
                name: TOOL_NAMES.GET_AIRPORTS,
                description: "Search for global airports.",
                inputSchema: {
                    type: "object",
                    properties: {
                        search: {
                            type: "string",
                            description: "Search query",
                        },
                        iata_code: { type: "string" },
                        icao_code: { type: "string" },
                        country_name: { type: "string" },
                    },
                },
                outputSchema: AVIATIONSTACK_OUTPUT_SCHEMA,
            },
            {
                name: TOOL_NAMES.GET_AIRLINES,
                description: "Search for global airlines.",
                inputSchema: {
                    type: "object",
                    properties: {
                        airline_name: { type: "string" },
                        iata_code: { type: "string" },
                        icao_code: { type: "string" },
                    },
                },
                outputSchema: AVIATIONSTACK_OUTPUT_SCHEMA,
            },
            {
                name: TOOL_NAMES.GET_ROUTES,
                description: "Get information about airline routes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        dep_iata: {
                            type: "string",
                            description: "Departure airport IATA code",
                        },
                        arr_iata: {
                            type: "string",
                            description: "Arrival airport IATA code",
                        },
                        airline_name: { type: "string" },
                    },
                },
                outputSchema: AVIATIONSTACK_OUTPUT_SCHEMA,
            },
            {
                name: TOOL_NAMES.GET_AIRPLANES,
                description: "Get information about specific aircraft.",
                inputSchema: {
                    type: "object",
                    properties: {
                        registration_number: { type: "string" },
                        iata_type: { type: "string" },
                    },
                },
                outputSchema: AVIATIONSTACK_OUTPUT_SCHEMA,
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const endpoint = ENDPOINT_MAP[name];
    if (!endpoint) {
        const error = createErrorPayload(
            "unknown_tool",
            `Unknown tool: ${name}. Valid tools: ${Object.keys(ENDPOINT_MAP).join(", ")}`
        );
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error }, null, 2),
                },
            ],
            isError: true,
        };
    }

    let aviationClient: AviationstackClient;
    try {
        aviationClient = getClient();
    } catch (err) {
        if (err instanceof AviationstackAPIError) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: err.error }, null, 2),
                    },
                ],
                isError: true,
            };
        }
        const error = createErrorPayload(
            "client_initialization_failed",
            `Failed to initialize Aviationstack client: ${String(err)}`
        );
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error }, null, 2),
                },
            ],
            isError: true,
        };
    }

    try {
        const result = await aviationClient.fetch(endpoint, args ?? {});
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (err) {
        if (err instanceof AviationstackAPIError) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: err.error }, null, 2),
                    },
                ],
                isError: true,
            };
        }
        const error = createErrorPayload(
            "unexpected_error",
            `Unexpected error in MCP server: ${String(err)}`
        );
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error }, null, 2),
                },
            ],
            isError: true,
        };
    }
});

// Resources: provide aviationstack API docs as a resource
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: [
            {
                uri: "aviationstack://docs",
                name: "Aviationstack API Documentation",
                description: "Complete documentation for Aviationstack MCP tools and usage",
                mimeType: "text/plain",
            },
            {
                uri: "aviationstack://endpoints",
                name: "Available Endpoints",
                description: "List of all available Aviationstack API endpoints",
                mimeType: "application/json",
            },
        ],
    };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === "aviationstack://docs") {
        const docs = `# Aviationstack MCP Server Documentation

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
`;
        return {
            contents: [
                {
                    uri,
                    mimeType: "text/plain",
                    text: docs,
                },
            ],
        };
    } else if (uri === "aviationstack://endpoints") {
        const endpoints = {
            endpoints: [
                { name: "flights", tool: "aviationstack_get_flights" },
                { name: "airports", tool: "aviationstack_get_airports" },
                { name: "airlines", tool: "aviationstack_get_airlines" },
                { name: "routes", tool: "aviationstack_get_routes" },
                { name: "airplanes", tool: "aviationstack_get_airplanes" },
            ],
        };
        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(endpoints, null, 2),
                },
            ],
        };
    } else {
        throw new Error(`Unknown resource: ${uri}`);
    }
});

// Prompts: provide helpful prompts for common aviation queries
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: "flight_search_helper",
                description: "Help users search for flights using natural language",
                arguments: [
                    {
                        name: "query",
                        description: "Natural language flight search query",
                        required: true,
                    },
                ],
            },
            {
                name: "airport_lookup",
                description: "Get airport information by IATA/ICAO code or name",
                arguments: [
                    {
                        name: "airport_info",
                        description: "Airport name, IATA code, or ICAO code",
                        required: true,
                    },
                ],
            },
        ],
    };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === "flight_search_helper") {
        const query = args?.query || "";
        return {
            description: "Flight search helper prompt",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Help me search for flights with this query: "${query}"

Please use the aviationstack_get_flights tool with appropriate parameters:
- flight_date: Use YYYY-MM-DD format if date mentioned
- dep_iata: Departure airport IATA code if mentioned  
- arr_iata: Arrival airport IATA code if mentioned
- airline_name: Airline name if mentioned
- flight_number: Flight number if mentioned
- flight_status: Filter by status if mentioned (scheduled, active, landed, cancelled, incident, diverted)

Return the results in a clear, readable format.`,
                    },
                },
            ],
        };
    } else if (name === "airport_lookup") {
        const airportInfo = args?.airport_info || "";
        return {
            description: "Airport lookup prompt",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Find information about this airport: "${airportInfo}"

Please use the aviationstack_get_airports tool with appropriate parameters:
- search: General search term if airport name provided
- iata_code: IATA code if provided
- icao_code: ICAO code if provided  
- country_name: Country name if mentioned

Return detailed airport information including location, codes, and other available details.`,
                    },
                },
            ],
        };
    } else {
        throw new Error(`Unknown prompt: ${name}`);
    }
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [],
}));

// Prompts: flight search prompt template
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
        {
            name: "aviationstack_flight_search",
            description: "Search for flights by criteria",
            arguments: [
                {
                    name: "flight_number",
                    description: "Optional flight number (e.g. BA123)",
                },
                {
                    name: "dep_iata",
                    description: "Departure airport IATA code",
                },
                {
                    name: "arr_iata",
                    description: "Arrival airport IATA code",
                },
            ],
        },
    ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === "aviationstack_flight_search") {
        const flightNumber = (args?.flight_number as string) ?? "";
        const depIata = (args?.dep_iata as string) ?? "";
        const arrIata = (args?.arr_iata as string) ?? "";
        const parts: string[] = ["Search for flights"];
        if (flightNumber) parts.push(`with flight number ${flightNumber}`);
        if (depIata) parts.push(`departing from ${depIata}`);
        if (arrIata) parts.push(`arriving at ${arrIata}`);
        const userMessage = parts.join(" ");
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: userMessage,
                    },
                },
            ],
        };
    }
    throw new Error(`Unknown prompt: ${name}`);
});

const runServer = async (): Promise<void> => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Aviationstack MCP Server running on stdio");
};

const isMain = process.argv[1] && 
    (process.argv[1].endsWith("index.js") || process.argv[1].endsWith("index.ts"));

if (isMain) {
    runServer().catch((err) => {
        console.error("Fatal error running server:", err);
        process.exit(1);
    });
}
