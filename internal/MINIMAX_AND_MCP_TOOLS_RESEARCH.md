---
title: MiniMax 与 MCP 调研
description: MiniMax AI 工具调用和 MCP 协议研究
---

# MiniMax Skills & MCP Tools Research

> Research on MiniMax AI's tool calling capabilities and the Model Context Protocol (MCP) standard.

## Executive Summary

MiniMax supports **OpenAI/Anthropic-compatible function calling**, while **MCP (Model Context Protocol)** is the emerging industry standard for tool integration. MiniMax also provides an official **MCP Server** for their media generation APIs (TTS, video, image).

**Key Finding**: MiniMax M2's function calling is compatible with both OpenAI and Anthropic API formats, making it easy to swap providers. MCP is the future-proof standard but adds architectural complexity.

---

## 1. MiniMax Function Calling (Skills)

### Overview

MiniMax M2/M2.1 supports **tool calling** (also called function calling) with OpenAI and Anthropic API compatibility.

> "The model can be found on Hugging Face, GitHub and ModelScope, as well as through MiniMax's API. It supports OpenAI and Anthropic API standards."
> — [VentureBeat](https://venturebeat.com/ai/minimax-m2-is-the-new-king-of-open-source-llms-especially-for-agentic-tool)

### Tool Definition Schema

```json
{
  "name": "function_name",
  "description": "Human-readable description of what the function does",
  "input_schema": {
    "type": "object",
    "properties": {
      "parameter_name": {
        "type": "string",
        "description": "Parameter description"
      }
    },
    "required": ["parameter_name"]
  }
}
```

### Response Structure

When MiniMax decides to call a tool, the response includes:

| Field | Description |
|-------|-------------|
| `thinking` / `reasoning_details` | Internal reasoning before tool call |
| `text` / `content` | Text output (if any) |
| `tool_calls` | Array of tools to invoke |
| `tool_calls[].function.name` | Function name |
| `tool_calls[].function.arguments` | JSON parameters |
| `tool_calls[].id` | Unique call ID |

### Multi-Turn Tool Calling Flow

```
User Message → MiniMax → tool_use response
                            ↓
                    Execute tool locally
                            ↓
                    Return tool_result
                            ↓
                    MiniMax → Final answer
```

**Critical**: The complete assistant response (including thinking blocks) must be appended to conversation history to maintain the reasoning chain.

### API Endpoints

| SDK Style | Base URL | Model |
|-----------|----------|-------|
| Anthropic | `https://api.minimax.io/anthropic` | `MiniMax-M2` |
| OpenAI | `https://api.minimax.io/v1` | `MiniMax-M2` |

### Performance

> "M2 now ranks first among all open-weight systems worldwide on the Intelligence Index. Its cost per token is only 8% of Anthropic Claude Sonnet and its speed is about twice as fast."
> — [MiniMax Documentation](https://platform.minimax.io/docs/guides/text-m2-function-call)

---

## 2. MCP (Model Context Protocol) Standard

### What is MCP?

MCP is an open standard introduced by Anthropic in November 2024 that standardizes how AI systems integrate with external tools, data sources, and systems.

> "MCP re-uses the message-flow ideas of the Language Server Protocol (LSP) and is transported over JSON-RPC 2.0."
> — [Model Context Protocol Spec](https://modelcontextprotocol.io/specification/2025-11-25)

### Adoption

- **November 2024**: Anthropic introduces MCP
- **September 2025**: MCP Registry launched
- **November 2025**: New spec with async tasks, better OAuth
- **December 2025**: Donated to Linux Foundation (AAIF)
- **Adopters**: OpenAI, Google DeepMind, Cursor, Windsurf, Zed

### Architecture

```
┌─────────────────┐
│  Host (Claude)  │  ← LLM application
└────────┬────────┘
         │
┌────────▼────────┐
│  MCP Client     │  ← Protocol connector
└────────┬────────┘
         │ JSON-RPC 2.0
┌────────▼────────┐
│  MCP Server     │  ← Tool/resource provider
└─────────────────┘
```

### MCP Primitives

| Primitive | Direction | Purpose |
|-----------|-----------|---------|
| **Tools** | Server → Client | Functions the AI can call |
| **Resources** | Server → Client | Data/context to provide |
| **Prompts** | Server → Client | Templated messages |
| **Sampling** | Client → Server | Server-initiated LLM calls |
| **Elicitation** | Client → Server | Request user input |

### MCP Tool Schema (Official Spec)

```json
{
  "name": "get_weather",
  "title": "Weather Information Provider",
  "description": "Get current weather information for a location",
  "inputSchema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name or zip code"
      }
    },
    "required": ["location"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "temperature": { "type": "number" },
      "conditions": { "type": "string" }
    },
    "required": ["temperature", "conditions"]
  }
}
```

### MCP Tool Result

```json
{
  "content": [
    {
      "type": "text",
      "text": "Current weather in New York: 72°F, Partly cloudy"
    }
  ],
  "structuredContent": {
    "temperature": 72,
    "conditions": "Partly cloudy"
  },
  "isError": false
}
```

### MCP Error Handling

| Error Type | When | Example |
|------------|------|---------|
| **Protocol Error** | Malformed request, unknown tool | `{"code": -32602, "message": "Unknown tool"}` |
| **Tool Execution Error** | API failure, validation error | `{"isError": true, "content": [...]}` |

Tool execution errors should be fed back to the LLM for self-correction.

---

## 3. MiniMax Official MCP Server

MiniMax provides an **official MCP Server** for their media generation APIs.

> "Official MiniMax Model Context Protocol (MCP) server that enables interaction with powerful Text to Speech, image generation and video generation APIs."
> — [GitHub MiniMax-MCP](https://github.com/MiniMax-AI/MiniMax-MCP)

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `text_to_speech` | Convert text to speech |
| `voice_clone` | Clone a voice from audio |
| `voice_design` | Create custom voice from description |
| `generate_image` | Text-to-image generation |
| `generate_video` | Text-to-video (Hailuo-02) |
| `music_generation` | Generate music (music-1.5) |

### Implementations

- **Python**: [MiniMax-AI/MiniMax-MCP](https://github.com/MiniMax-AI/MiniMax-MCP)
- **JavaScript**: [MiniMax-AI/MiniMax-MCP-JS](https://github.com/MiniMax-AI/MiniMax-MCP-JS)

### Compatible Clients

- Claude Desktop
- Cursor
- Windsurf
- OpenAI Agents

---

## 4. Comparison: Function Calling vs MCP

| Aspect | Function Calling | MCP |
|--------|------------------|-----|
| **Protocol** | HTTP REST (per-provider) | JSON-RPC 2.0 (standard) |
| **Tool Discovery** | Defined per request | `tools/list` request |
| **Execution** | App handles execution | Server handles execution |
| **Transport** | HTTP | stdio, HTTP, WebSocket |
| **State** | Stateless | Stateful connections |
| **Resources** | Not supported | First-class primitive |
| **Standardization** | Provider-specific | Cross-provider standard |

### When to Use What

**Use Function Calling when:**
- Simple tool needs
- Direct API integration
- Provider-specific features
- Minimal infrastructure

**Use MCP when:**
- Multiple AI clients (Claude, Cursor, etc.)
- Complex tool ecosystems
- Need resource/context sharing
- Building reusable tool servers

---

## 5. Recommendations for MyFate

### Current State (Function Calling)

The app uses MiniMax with OpenAI-compatible function calling. This is fine for now.

### Recommended Evolution

```
Phase 1 (Now): Function Calling
├── Define tools in chat endpoint
├── Execute tools server-side
└── Return results to MiniMax

Phase 2 (Future): MCP Server
├── Create myfate-mcp-server
├── Expose BaZi tools (liunian, dayun, calendar)
├── Support Claude Desktop, Cursor
└── Enable multi-client access
```

### Tool Schema for MyFate (Function Calling Format)

```python
MYFATE_TOOLS = [
    {
        "name": "get_liunian_analysis",
        "description": "获取流年运势分析。用于用户询问某年运势、明年运势等问题。",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {
                    "type": "integer",
                    "description": "要分析的年份，如 2026"
                }
            },
            "required": ["year"]
        }
    },
    {
        "name": "get_day_quality",
        "description": "计算某日是否为吉日。用于用户询问择日、好日子等问题。",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer"},
                "month": {"type": "integer"},
                "day": {"type": "integer"}
            },
            "required": ["year", "month", "day"]
        }
    },
    {
        "name": "show_calendar",
        "description": "在前端显示日历视图。用于用户想看月历、选日期时。",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {"type": "integer"},
                "month": {"type": "integer"}
            },
            "required": ["year", "month"]
        }
    }
]
```

### MCP Server (Future)

If you want Claude Desktop / Cursor users to access MyFate tools:

```python
# myfate-mcp-server/server.py
from mcp import Server, Tool

server = Server("myfate")

@server.tool()
async def get_liunian_analysis(year: int) -> dict:
    """获取流年运势分析"""
    # Call FastAPI backend
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://api:8000/api/v1/liunian/analyze",
            json={"year": year, "profile_id": context.profile_id}
        )
    return response.json()
```

---

## Sources

- [MiniMax M2 Tool Use Documentation](https://platform.minimax.io/docs/guides/text-m2-function-call)
- [MiniMax M2 VentureBeat Article](https://venturebeat.com/ai/minimax-m2-is-the-new-king-of-open-source-llms-especially-for-agentic-tool)
- [MiniMax Official MCP Server](https://github.com/MiniMax-AI/MiniMax-MCP)
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [MCP November 2025 Release](https://workos.com/blog/mcp-2025-11-25-spec-update)
- [MCP Wikipedia](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- [MCP Tool Schema Guide](https://www.merge.dev/blog/mcp-tool-schema)
