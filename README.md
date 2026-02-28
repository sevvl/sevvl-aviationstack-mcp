# Aviationstack MCP Servers

Model Context Protocol (MCP) server + client for the Aviationstack API. Python ve TypeScript implementasyonları.

## Proje Yapısı

- `python/`: Python MCP server (`mcp-python-sdk`)
- `typescript/`: TypeScript MCP server + **MCP Client** (`@modelcontextprotocol/sdk`)

## Özellikler

### Tools (aviationstack_* prefix)

| Tool | Açıklama |
|------|----------|
| `aviationstack_get_flights` | Uçuş verileri |
| `aviationstack_get_airports` | Havaalanı araması |
| `aviationstack_get_airlines` | Havayolu araması |
| `aviationstack_get_routes` | Rota verileri |
| `aviationstack_get_airplanes` | Uçak bilgisi |

### Output Schema (meta, items, raw)

Başarılı yanıt:

```json
{
  "meta": { "provider": "aviationstack", "resource": "flights", "page": 1, "total": 100 },
  "items": [{ "flight_number": "BA123", ... }],
  "raw": { "data": [...], "pagination": {...} }
}
```

Hata:

```json
{ "error": { "provider": "aviationstack", "code": "...", "message": "..." } }
```

### MCP Capabilities

- **tools**: Tüm aviationstack araçları
- **resources**: `aviationstack://docs` dokümantasyon
- **prompts**: `aviationstack_flight_search` şablonu

### Best Practices

- **Prefix**: Tüm araçlar `aviationstack_` ile başlar
- **API Key**: `AVIATIONSTACK_API_KEY` env değişkeni (asla hardcode edilmez)
- **Error handling**: Yapısal hata payload'ı
- **async/await**: Uyumlu async kullanımı

---

## Kurulum ve Çalıştırma

### Gereksinimler

- [Aviationstack API Key](https://aviationstack.com/)
- Python 3.10+ veya Node.js 18+

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

### 4. TypeScript MCP Client (Server'a Bağlanma)

Client, stdio transport ile server'a bağlanır ve tools/resources/prompts keşfeder.

**TypeScript server ile:**

```bash
cd typescript
npm run build
export AVIATIONSTACK_API_KEY=your_key
npm run client
```

**Python server ile:**

```bash
cd typescript
npm run build
export AVIATIONSTACK_API_KEY=your_key
export MCP_SERVER_COMMAND=python
export MCP_SERVER_ARGS='["-m", "aviationstack_mcp_server.server"]'
npm run client
```

*Not: Python server için önce `pip install .` ile paketi kurun.*

### 5. Claude Desktop Konfigürasyonu

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

| Değişken | Açıklama |
|----------|----------|
| `AVIATIONSTACK_API_KEY` | **Zorunlu** – API anahtarı |
| `AVIATIONSTACK_BASE_URL` | API base URL (varsayılan: api.aviationstack.com) |
| `AVIATIONSTACK_TIMEOUT_SECONDS` | İstek timeout (varsayılan: 10) |
| `AVIATIONSTACK_MAX_RETRIES` | Retry sayısı (varsayılan: 2) |
| `MCP_SERVER_COMMAND` | Client: server komutu (`python` veya `node`) |
| `MCP_SERVER_ARGS` | Client: JSON array, server argümanları |

---

## Detaylı Dokümantasyon

- [Python README](./python/README.md)
- [TypeScript README](./typescript/README.md)
