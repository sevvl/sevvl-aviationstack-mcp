import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import {
    AviationstackAPIError,
    AviationstackClient,
    AviationstackErrorPayload,
} from "./client.js";

dotenv.config();

export const server = new Server(
    {
        name: "aviationstack-mcp-server",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_flights",
                description: "Get real-time and historical flight data.",
                inputSchema: {
                    type: "object",
                    properties: {
                        flight_status: { type: "string", enum: ["scheduled", "active", "landed", "cancelled", "incident", "diverted"] },
                        flight_date: { type: "string", description: "Date in YYYY-MM-DD format" },
                        dep_iata: { type: "string", description: "Departure airport IATA code" },
                        arr_iata: { type: "string", description: "Arrival airport IATA code" },
                        airline_name: { type: "string" },
                        flight_number: { type: "string" },
                    },
                },
            },
            {
                name: "get_airports",
                description: "Search for global airports.",
                inputSchema: {
                    type: "object",
                    properties: {
                        search: { type: "string", description: "Search query" },
                        iata_code: { type: "string" },
                        icao_code: { type: "string" },
                        country_name: { type: "string" },
                    },
                },
            },
            {
                name: "get_airlines",
                description: "Search for global airlines.",
                inputSchema: {
                    type: "object",
                    properties: {
                        airline_name: { type: "string" },
                        iata_code: { type: "string" },
                        icao_code: { type: "string" },
                    },
                },
            },
            {
                name: "get_routes",
                description: "Get information about airline routes.",
                inputSchema: {
                    type: "object",
                    properties: {
                        dep_iata: { type: "string", description: "Departure airport IATA code" },
                        arr_iata: { type: "string", description: "Arrival airport IATA code" },
                        airline_name: { type: "string" },
                    },
                },
            },
            {
                name: "get_airplanes",
                description: "Get information about specific aircraft.",
                inputSchema: {
                    type: "object",
                    properties: {
                        registration_number: { type: "string" },
                        iata_type: { type: "string" },
                    },
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const endpointMap: Record<string, string> = {
        get_flights: "flights",
        get_airports: "airports",
        get_airlines: "airlines",
        get_routes: "routes",
        get_airplanes: "airplanes",
    };

    const endpoint = endpointMap[name];
    if (!endpoint) {
        const error: AviationstackErrorPayload = {
            provider: "aviationstack",
            code: "unknown_tool",
            message: `Unknown tool: ${name}`,
            status_code: null,
            retryable: false,
            rate_limited: false,
            retry_after_seconds: null,
        };

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
    } catch (error) {
        if (error instanceof AviationstackAPIError) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: error.error }, null, 2),
                    },
                ],
                isError: true,
            };
        }

        const unexpected: AviationstackErrorPayload = {
            provider: "aviationstack",
            code: "client_initialization_failed",
            message: `Failed to initialize Aviationstack client: ${String(error)}`,
            status_code: null,
            retryable: false,
            rate_limited: false,
            retry_after_seconds: null,
        };

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: unexpected }, null, 2),
                },
            ],
            isError: true,
        };
    }

    try {
        const result = await aviationClient.fetch(endpoint, args || {});
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error) {
        if (error instanceof AviationstackAPIError) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: error.error }, null, 2),
                    },
                ],
                isError: true,
            };
        }

        const unexpected: AviationstackErrorPayload = {
            provider: "aviationstack",
            code: "unexpected_error",
            message: `Unexpected error in MCP server: ${String(error)}`,
            status_code: null,
            retryable: false,
            rate_limited: false,
            retry_after_seconds: null,
        };

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: unexpected }, null, 2),
                },
            ],
            isError: true,
        };
    }
});

const runServer = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Aviationstack MCP Server running on stdio");
};

if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'))) {
    runServer().catch((error) => {
        console.error("Fatal error running server:", error);
        process.exit(1);
    });
}
