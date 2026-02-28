# Aviationstack MCP Server (TypeScript)

A Model Context Protocol (MCP) server that provides access to global aviation data via the Aviationstack API.

## Features

- **Tools** (aviationstack_* prefix):
  - `aviationstack_get_flights`: Real-time and historical flight data
  - `aviationstack_get_airports`: Global airport search
  - `aviationstack_get_airlines`: Global airline search
  - `aviationstack_get_routes`: Airline routes data
  - `aviationstack_get_airplanes`: Aircraft information
- **Resources**: `aviationstack://docs` documentation
- **Prompts**: `aviationstack_flight_search` template
- **Output schema**: Structured response (meta, items, raw)

## Setup

1.  **Environment Variable**: Obtain an API key from [Aviationstack](https://aviationstack.com/) and set it as an environment variable in a `.env` file or your shell:
    ```bash
    AVIATIONSTACK_API_KEY=your_api_key_here
    ```

2.  **Installation**:
    ```bash
    npm install
    ```

3.  **Build**:
    ```bash
    npm run build
    ```

## Running

The server uses the `stdio` transport.

```bash
npm start
```

## Configuration for Claude Desktop

Add this to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "aviationstack-ts": {
      "command": "node",
      "args": ["f:/asli/aviationstack-mcp/typescript/dist/index.js"],
      "env": {
        "AVIATIONSTACK_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## MCP Client

Server'a stdio ile bağlanan örnek client:

```bash
npm run build
export AVIATIONSTACK_API_KEY=your_key
npm run client
```

Python server kullanmak için:

```bash
export MCP_SERVER_COMMAND=python
export MCP_SERVER_ARGS='["-m", "aviationstack_mcp_server.server"]'
npm run client
```

## Testing

```bash
npm test
```
