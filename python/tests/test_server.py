import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from aviationstack_mcp_server.server import handle_call_tool, handle_list_tools
from aviationstack_mcp_server.schemas import TOOL_NAMES


@pytest.mark.asyncio
async def test_list_tools():
    tools = await handle_list_tools()
    assert len(tools) == 5
    assert tools[0].name == TOOL_NAMES["GET_FLIGHTS"]
    assert tools[1].name == TOOL_NAMES["GET_AIRPORTS"]
    assert tools[0].outputSchema is not None


@pytest.mark.asyncio
@patch("aviationstack_mcp_server.server.get_client")
async def test_call_tool_get_flights(mock_get_client):
    mock_client = MagicMock()
    mock_client.fetch = AsyncMock(
        return_value={
            "meta": {"provider": "aviationstack", "resource": "flights"},
            "items": [{"flight_number": "123"}],
            "raw": {"data": [{"flight_number": "123"}]},
        }
    )
    mock_get_client.return_value = mock_client

    result = await handle_call_tool(
        TOOL_NAMES["GET_FLIGHTS"], {"flight_number": "123"}
    )

    assert len(result) == 1
    parsed = json.loads(result[0].text)
    assert "items" in parsed
    assert parsed["items"][0]["flight_number"] == "123"
    mock_client.fetch.assert_called_once_with("flights", {"flight_number": "123"})


@pytest.mark.asyncio
async def test_call_tool_unknown():
    result = await handle_call_tool("unknown_tool", {})
    assert len(result) == 1
    parsed = json.loads(result[0].text)
    assert "error" in parsed
    assert parsed["error"]["code"] == "unknown_tool"
