<<<<<<< HEAD
# Aviationstack MCP Servers

This repository contains two implementations of a Model Context Protocol (MCP) server for the Aviationstack API: one in **Python** and one in **TypeScript**.

## Project Structure

- `python/`: Python implementation using `mcp-python-sdk`.
- `typescript/`: TypeScript implementation using `@modelcontextprotocol/sdk`.

## Getting Started

### Prerequisites

- [Aviationstack API Key](https://aviationstack.com/)
- Python 3.10+
- Node.js 18+

### Setup

Each implementation has its own setup instructions in its respective directory.

- [Python Setup](./python/README.md)
- [TypeScript Setup](./typescript/README.md)

## Common Tools

Both servers expose the following tools:

- `get_flights`: Retrieve real-time or historical flight info.
- `get_airports`: Search for airports globally.
- `get_airlines`: Search for airlines globally.
- `get_routes`: Retrieve airline route data.
- `get_airplanes`: Retrieve specific aircraft data.

## Configuration

You can use either server with MCP-compatible LLM clients (like Claude Desktop). Ensure the `AVIATIONSTACK_API_KEY` is set in the environment.

### Claude Desktop Example (Python)

```json
"aviationstack-python": {
  "command": "python",
  "args": ["-m", "aviationstack_mcp_server.server"],
  "env": {
    "AVIATIONSTACK_API_KEY": "YOUR_KEY"
  }
}
```

### Claude Desktop Example (TypeScript)

```json
"aviationstack-typescript": {
  "command": "node",
  "args": ["path/to/typescript/dist/index.js"],
  "env": {
    "AVIATIONSTACK_API_KEY": "YOUR_KEY"
  }
}
```
=======
# mcp-agents
>>>>>>> origin/main
