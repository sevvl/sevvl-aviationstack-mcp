import pytest
from unittest.mock import patch, AsyncMock
from aviationstack_mcp_server.server import handle_call_tool, handle_list_tools

@pytest.mark.asyncio
async def test_list_tools():
    tools = await handle_list_tools()
    assert len(tools) == 5
    assert tools[0].name == "get_flights"
    assert tools[1].name == "get_airports"

@pytest.mark.asyncio
@patch("aviationstack_mcp_server.server.fetch_aviation_data")
async def test_call_tool_get_flights(mock_fetch):
    mock_fetch.return_value = {"data": [{"flight_number": "123"}]}
    
    result = await handle_call_tool("get_flights", {"flight_number": "123"})
    
    assert len(result) == 1
    assert "flight_number" in result[0].text
    mock_fetch.assert_called_once_with("flights", {"flight_number": "123"})

@pytest.mark.asyncio
async def test_call_tool_unknown():
    with pytest.raises(ValueError, match="Unknown tool: unknown_tool"):
        await handle_call_tool("unknown_tool", {})
