# Aviationstack MCP Server (TypeScript)

A Model Context Protocol (MCP) server that provides access to global aviation data via the Aviationstack API.

## Features

- `get_flights`: Real-time and historical flight data.
- `get_airports`: Global airport search.
- `get_airlines`: Global airline search.
- `get_routes`: Airline routes data.
- `get_airplanes`: Aircraft information.

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

## Testing

```bash
npm test
```
