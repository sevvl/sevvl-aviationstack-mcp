/**
 * MCP Client for Aviationstack MCP Server
 *
 * Connects to the Aviationstack MCP server via stdio transport.
 * Supports tools, resources, and prompts capabilities.
 *
 * Usage:
 *   npm run client:tsx  # or: npx tsx src/mcp-client.ts
 *   npm run client     # or: node dist/mcp-client.js (after build)
 *
 * Environment:
 *   AVIATIONSTACK_API_KEY - Required when using Python/TS server
 *   MCP_SERVER_COMMAND - Optional: "python" | "node" (default: "node")
 *   MCP_SERVER_ARGS - Optional: JSON array of args
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DEFAULT_SERVER_SCRIPT = join(ROOT, "dist", "index.js");

const DEFAULT_SERVER_CONFIG = {
    command: "node",
    args: [DEFAULT_SERVER_SCRIPT],
    env: {
        ...process.env,
        AVIATIONSTACK_API_KEY: process.env.AVIATIONSTACK_API_KEY ?? "",
    },
} as const;

async function main(): Promise<void> {
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
        console.error(
            "Error: AVIATIONSTACK_API_KEY environment variable is not set."
        );
        console.error(
            "Obtain an API key from https://aviationstack.com/ and set it:"
        );
        console.error("  export AVIATIONSTACK_API_KEY=your_api_key");
        process.exit(1);
    }

    const serverCommand =
        process.env.MCP_SERVER_COMMAND ?? DEFAULT_SERVER_CONFIG.command;
    let serverArgs: string[] = DEFAULT_SERVER_CONFIG.args as unknown as string[];

    const argsEnv = process.env.MCP_SERVER_ARGS;
    if (argsEnv) {
        try {
            serverArgs = JSON.parse(argsEnv) as string[];
        } catch {
            console.warn("Invalid MCP_SERVER_ARGS JSON, using default args");
        }
    }

    // Python server: python -m aviationstack_mcp_server.server
    if (serverCommand === "python" || serverCommand === "python3") {
        serverArgs = ["-m", "aviationstack_mcp_server.server"];
    }

    const transport = new StdioClientTransport({
        command: serverCommand,
        args: serverArgs,
        env: {
            ...process.env,
            AVIATIONSTACK_API_KEY: apiKey,
        },
    });

    const client = new Client(
        {
            name: "aviationstack-mcp-client",
            version: "0.1.0",
        },
        {}
    );

    try {
        await client.connect(transport);
        console.error("Connected to Aviationstack MCP Server");
    } catch (err) {
        console.error("Failed to connect:", err);
        process.exit(1);
    }

    try {
        // List tools
        const { tools } = await client.listTools();
        console.log("\n=== Available Tools ===");
        for (const tool of tools) {
            console.log(`  - ${tool.name}: ${tool.description ?? ""}`);
        }

        // List prompts (if server supports)
        try {
            const { prompts } = await client.listPrompts();
            if (prompts.length > 0) {
                console.log("\n=== Available Prompts ===");
                for (const p of prompts) {
                    console.log(`  - ${p.name}: ${p.description ?? ""}`);
                }
            }
        } catch {
            // Server may not support prompts
        }

        // List resources (if server supports)
        try {
            const { resources } = await client.listResources();
            if (resources.length > 0) {
                console.log("\n=== Available Resources ===");
                for (const r of resources) {
                    console.log(`  - ${r.name} (${r.uri})`);
                }
            }
        } catch {
            // Server may not support resources
        }

        // Example: call aviationstack_get_flights with minimal args
        const firstTool = tools[0];
        if (firstTool) {
            console.log(`\n=== Example: Calling ${firstTool.name} ===`);
            const result = await client.callTool({
                name: firstTool.name,
                arguments: {},
            });

            if (result.isError) {
                console.error("Tool returned error:", result.content);
            } else {
                const content = result.content;
                const contentArr = Array.isArray(content) ? content : [];
                const textContent = contentArr.find(
                    (c: { type?: string }) => c.type === "text"
                ) as { type: "text"; text: string } | undefined;
                if (textContent && "text" in textContent) {
                    const parsed = JSON.parse(textContent.text);
                    if (parsed.meta) {
                        console.log(
                            `  Meta: resource=${parsed.meta.resource}, total=${parsed.meta.total ?? "N/A"}`
                        );
                    }
                    if (parsed.items?.length) {
                        console.log(`  Items count: ${parsed.items.length}`);
                        console.log("  First item:", JSON.stringify(parsed.items[0], null, 2).slice(0, 200) + "...");
                    }
                }
            }
        }
    } finally {
        await client.close();
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
