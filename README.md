# Aviationstack MCP Servers

This repository contains two implementations of a Model Context Protocol (MCP) server for the Aviationstack API: one in **Python** and one in **TypeScript**, plus an MCP client.

## Project Structure

- `python/`: Python MCP server using `mcp-python-sdk`
- `typescript/`: TypeScript MCP server + **MCP Client** using `@modelcontextprotocol/sdk`

## Features

### Tools (aviationstack_* prefix)

| Tool | Description |
|------|-------------|
| `aviationstack_get_flights` | Flight data |
| `aviationstack_get_airports` | Airport search |
| `aviationstack_get_airlines` | Airline search |
| `aviationstack_get_routes` | Route data |
| `aviationstack_get_airplanes` | Aircraft information |

### Output Schema (meta, items, raw)

Success response:

```json
{
  "meta": { "provider": "aviationstack", "resource": "flights", "page": 1, "total": 100 },
  "items": [{ "flight_number": "BA123", ... }],
  "raw": { "data": [...], "pagination": {...} }
}
```

Error response:

```json
{ "error": { "provider": "aviationstack", "code": "...", "message": "..." } }
```

### MCP Capabilities

- **tools**: All aviationstack tools
- **resources**: `aviationstack://docs` documentation
- **prompts**: `aviationstack_flight_search` template

### Best Practices

- **Prefix**: All tools use `aviationstack_` prefix
- **API Key**: `AVIATIONSTACK_API_KEY` environment variable (never hardcoded)
- **Error handling**: Structured error payload
- **async/await**: Consistent async usage

---

## Setup and Running

### Prerequisites

- [Aviationstack API Key](https://aviationstack.com/)
- Python 3.10+ or Node.js 18+

### 1. API Key

```bash
export AVIATIONSTACK_API_KEY=your_api_key_here
```

### 2. Python Server

```bash
cd python
pip install .
python -m aviationstack_mcp_server.server
```

### 3. TypeScript Server

```bash
cd typescript
npm install
npm run build
npm start
```

### 4. TypeScript MCP Client (Connecting to Server)

The client connects to the server via stdio transport and discovers tools, resources, and prompts.

**With TypeScript server:**

```bash
cd typescript
npm run build
export AVIATIONSTACK_API_KEY=your_key
npm run client
```

**With Python server:**

```bash
cd typescript
npm run build
export AVIATIONSTACK_API_KEY=your_key
export MCP_SERVER_COMMAND=python
export MCP_SERVER_ARGS='["-m", "aviationstack_mcp_server.server"]'
npm run client
```

*Note: For Python server, first install the package with `pip install .`.*

### 5. Claude Desktop Configuration

**Python:**

```json
{
  "mcpServers": {
    "aviationstack": {
      "command": "python",
      "args": ["-m", "aviationstack_mcp_server.server"],
      "env": {
        "AVIATIONSTACK_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

**TypeScript:**

```json
{
  "mcpServers": {
    "aviationstack": {
      "command": "node",
      "args": ["C:/path/to/mcp-agents/typescript/dist/index.js"],
      "env": {
        "AVIATIONSTACK_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

---

## Test

**Python:**

```bash
cd python
pip install ".[dev]"
pytest
```

**TypeScript:**

```bash
cd typescript
npm test
```

---

## Environment Variables

| Variable | Description |
|----------|--------------|
| `AVIATIONSTACK_API_KEY` | **Required** – API key |
| `AVIATIONSTACK_BASE_URL` | API base URL (default: api.aviationstack.com) |
| `AVIATIONSTACK_TIMEOUT_SECONDS` | Request timeout (default: 10) |
| `AVIATIONSTACK_MAX_RETRIES` | Retry count (default: 2) |
| `MCP_SERVER_COMMAND` | Client: server command (`python` or `node`) |
| `MCP_SERVER_ARGS` | Client: JSON array of server arguments |

---

## Documentation

- [Python README](./python/README.md)
- [TypeScript README](./typescript/README.md)
