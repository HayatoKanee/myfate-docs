---
title: AI 聊天架构
description: MyFate AI Agent 架构设计文档
---

# Agentic Chat Architecture for MyFate

> How to build an AI agent that understands BaZi context and can call domain-specific tools.

## Current State

### What Works
- ✅ Chat streaming via SSE (`/api/v1/chat/stream`)
- ✅ BaZi context injection into system prompt
- ✅ Profile loading by `profile_id`
- ✅ LiuNian (流年) analysis service exists in domain layer

### What's Missing
- ❌ Tool/function calling - AI cannot call backend APIs
- ❌ LiuNian endpoint not exposed via API
- ❌ 大运 (DaYun / Luck Cycles) endpoint missing
- ❌ Frontend control - AI cannot update UI components
- ❌ Conversation history persistence (relies on client-side state)

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                              │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Chat UI                                                     │ │
│  │  ├── Messages (user + assistant)                            │ │
│  │  ├── Tool Results (rendered as cards/charts)                │ │
│  │  └── Frontend Actions (show modal, update sidebar, etc.)    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  useAgenticChat hook                                         │ │
│  │  ├── Sends messages to /api/v1/chat/stream                  │ │
│  │  ├── Handles tool_use blocks from AI                        │ │
│  │  ├── Executes frontend actions (MCP-style)                  │ │
│  │  └── Renders tool results inline                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (FastAPI)                                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  /api/v1/chat/stream (SSE)                                   │ │
│  │  ├── Injects BaZi context into system prompt                │ │
│  │  ├── Defines available tools for Claude                     │ │
│  │  ├── Streams text + tool_use blocks                         │ │
│  │  └── Executes tool calls, returns tool_result               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Tool Definitions (Skills)                                   │ │
│  │  ├── get_liunian_analysis    → LiunianAnalysisService       │ │
│  │  ├── get_dayun_cycles        → DaYunService (TODO)          │ │
│  │  ├── get_day_quality         → DayQualityService            │ │
│  │  ├── get_calendar_month      → CalendarService              │ │
│  │  ├── get_favorable_elements  → BaziAnalysisService          │ │
│  │  └── show_component          → Frontend action (MCP)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool Calling Flow

### How Anthropic Tool Use Works

1. **Define tools** with JSON schema when calling Claude API
2. Claude responds with `tool_use` content blocks when needed
3. **Execute tools** server-side and return `tool_result`
4. Claude synthesizes final response with tool results

```
User: "下一年运势如何？"
         │
         ▼
┌─────────────────────────────────┐
│  Claude (with tools defined)    │
│  Thinks: "I need to call        │
│  get_liunian_analysis for 2026" │
└─────────────────────────────────┘
         │
         ▼ (returns tool_use block)
┌─────────────────────────────────┐
│  {                              │
│    "type": "tool_use",          │
│    "name": "get_liunian",       │
│    "input": {"year": 2026}      │
│  }                              │
└─────────────────────────────────┘
         │
         ▼ (backend executes tool)
┌─────────────────────────────────┐
│  LiunianAnalysisService         │
│  .analyse_liunian(bazi, 2026)   │
│  → Returns structured data      │
└─────────────────────────────────┘
         │
         ▼ (send tool_result back)
┌─────────────────────────────────┐
│  Claude synthesizes:            │
│  "2026年是丙午年，对应你的流年   │
│   运势是..."                     │
└─────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Tool Definitions

Add tools to `/api/v1/chat/stream`:

```python
# routers/chat.py

CHAT_TOOLS = [
    {
        "name": "get_liunian_analysis",
        "description": "Get yearly fortune (流年) analysis for a specific year. "
                      "Use when user asks about yearly fortune, next year's luck, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "year": {
                    "type": "integer",
                    "description": "The year to analyze (e.g., 2026)"
                }
            },
            "required": ["year"]
        }
    },
    {
        "name": "get_day_quality",
        "description": "Calculate how auspicious a specific day is for the user. "
                      "Use when user asks about good/bad days, picking dates.",
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
        "description": "Show the calendar view on the frontend. "
                      "Use when user wants to see monthly calendar or pick dates.",
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

### Phase 2: Tool Execution Loop

```python
async def _stream_with_tools(
    messages: list[dict],
    system_prompt: str,
    tools: list[dict],
    bazi_context: dict,
    bazi_service: BaziAnalysisService,
    liunian_service: LiunianAnalysisService,
) -> AsyncGenerator[str, None]:
    """Stream response with tool calling support."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    while True:
        response = await client.messages.create(
            model=settings.ai_model,
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
            tools=tools,
        )

        # Check for tool use
        tool_uses = [b for b in response.content if b.type == "tool_use"]

        if not tool_uses:
            # No tools, just stream text
            for block in response.content:
                if block.type == "text":
                    yield f"data: {json.dumps({'content': block.text})}\n\n"
            break

        # Execute tools and continue conversation
        for tool_use in tool_uses:
            result = await _execute_tool(
                tool_use.name,
                tool_use.input,
                bazi_context,
                bazi_service,
                liunian_service,
            )

            # Send tool result to frontend for rendering
            yield f"data: {json.dumps({'tool_result': {'name': tool_use.name, 'result': result}})}\n\n"

            # Add to messages for next iteration
            messages.append({"role": "assistant", "content": response.content})
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": json.dumps(result)
                }]
            })

    yield "data: [DONE]\n\n"


async def _execute_tool(
    name: str,
    input: dict,
    bazi_context: dict,
    bazi_service: BaziAnalysisService,
    liunian_service: LiunianAnalysisService,
) -> dict:
    """Execute a tool and return result."""
    if name == "get_liunian_analysis":
        # Need the full bazi object, not just context
        analysis = liunian_service.analyse_liunian(
            bazi=bazi_context["bazi_obj"],
            shishen=bazi_context["shishen"],
            liunian_date=f"{input['year']}-06-01",  # Mid-year for LiNian
            is_strong=bazi_context["is_strong"],
            is_male=bazi_context["is_male"],
        )
        return {"year": input["year"], "analysis": analysis}

    elif name == "get_day_quality":
        quality = day_quality_service.calculate_day_quality(
            year=input["year"],
            month=input["month"],
            day=input["day"],
            favorable_wuxing=bazi_context["favorable_wuxing"],
        )
        return {
            "date": f"{input['year']}-{input['month']:02d}-{input['day']:02d}",
            "score": quality.score,
            "label": quality.label,
            "is_favorable": quality.is_favorable,
        }

    elif name == "show_calendar":
        # Frontend action - just return instruction
        return {
            "action": "show_calendar",
            "year": input["year"],
            "month": input["month"],
        }

    return {"error": f"Unknown tool: {name}"}
```

### Phase 3: Frontend Tool Result Handling

```typescript
// hooks/use-agentic-chat.ts

interface ToolResult {
  name: string;
  result: Record<string, unknown>;
}

interface StreamChunk {
  content?: string;
  tool_result?: ToolResult;
}

export function useAgenticChat() {
  const [messages, setMessages] = useState<Message[]>([]);

  const handleToolResult = useCallback((toolResult: ToolResult) => {
    const { name, result } = toolResult;

    switch (name) {
      case 'get_liunian_analysis':
        // Add as a special message with rich rendering
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: '',
          toolResult: {
            type: 'liunian',
            data: result,
          }
        }]);
        break;

      case 'show_calendar':
        // Dispatch frontend action
        router.push(`/calendar?year=${result.year}&month=${result.month}`);
        break;

      case 'get_day_quality':
        // Show inline card
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: '',
          toolResult: {
            type: 'day_quality',
            data: result,
          }
        }]);
        break;
    }
  }, []);

  const sendMessage = async (content: string) => {
    // ... existing SSE handling

    const parsed: StreamChunk = JSON.parse(data);

    if (parsed.tool_result) {
      handleToolResult(parsed.tool_result);
    } else if (parsed.content) {
      // Append to current message
    }
  };
}
```

---

## Missing Backend Endpoints

### 1. LiuNian (流年) Analysis Endpoint

```python
# routers/liunian.py

@router.post("/analyze", response_model=LiunianResponse)
async def analyze_liunian(
    request: LiunianRequest,
    user: CurrentUser | None = Depends(get_current_user_optional),
    bazi_service: BaziAnalysisService = Depends(get_bazi_service),
    liunian_service: LiunianAnalysisService = Depends(get_liunian_service),
) -> LiunianResponse:
    """Analyze yearly fortune for a given year."""
    # Load user's profile
    # Call liunian_service.analyse_liunian()
    # Return structured response
```

### 2. DaYun (大运) Cycles Endpoint

**Currently missing from domain layer!** Need to implement:

```python
# domain/services/dayun_calculator.py

class DaYunCalculator:
    """Calculate 10-year luck cycles (大运)."""

    def calculate_dayun_cycles(
        self,
        bazi: BaZi,
        birth_data: BirthData,
    ) -> list[DaYunCycle]:
        """
        Calculate all major luck cycles.

        Each cycle is 10 years and follows the month pillar
        forward (男阳女阴) or backward (男阴女阳).
        """
        pass

    def get_current_dayun(
        self,
        bazi: BaZi,
        birth_data: BirthData,
        current_date: date,
    ) -> DaYunCycle:
        """Get the current active luck cycle."""
        pass
```

---

## Frontend Actions (MCP-style)

The AI can trigger frontend state changes through special tool results:

| Action | Description | Example |
|--------|-------------|---------|
| `show_calendar` | Navigate to calendar view | `{action: "show_calendar", year: 2026, month: 1}` |
| `show_bazi_detail` | Expand BaZi analysis panel | `{action: "show_bazi_detail", section: "shishen"}` |
| `highlight_element` | Highlight element in WuXing chart | `{action: "highlight_element", element: "金"}` |
| `show_modal` | Display a modal with content | `{action: "show_modal", type: "confirm", message: "..."}` |

Implementation uses an event bus pattern:

```typescript
// lib/frontend-actions.ts

type FrontendAction =
  | { type: 'show_calendar'; year: number; month: number }
  | { type: 'highlight_element'; element: string }
  | { type: 'show_modal'; content: ReactNode };

const actionEmitter = new EventEmitter<FrontendAction>();

// In chat hook
if (toolResult.action) {
  actionEmitter.emit(toolResult as FrontendAction);
}

// In Calendar component
useEffect(() => {
  const unsub = actionEmitter.on('show_calendar', (action) => {
    setYear(action.year);
    setMonth(action.month);
  });
  return unsub;
}, []);
```

---

## Session Context (Within Conversation)

The AI maintains context through:

1. **System prompt injection** - User's BaZi profile loaded once per conversation
2. **Conversation history** - All previous messages in `messages` array
3. **Tool results** - Cached in conversation for reference

No server-side session storage needed for single conversations. The frontend manages state.

### Context Injection Example

```python
# In system prompt
"""
The user has the following BaZi profile:
- Name: 张三
- BaZi: 辛巳 丁酉 辛丑 丁酉
- Day Master: 辛 (Metal)
- Strength: Weak (身弱)
- Favorable: 土、金
- Unfavorable: 木、火、水

Current 大运: 壬戌 (2020-2030)
Current 流年: 2026 丙午年

Use this information when answering questions about fortune, compatibility, etc.
"""
```

---

## Summary

| Component | Status | Priority |
|-----------|--------|----------|
| Tool calling in chat endpoint | Missing | P0 |
| LiuNian API endpoint | Missing | P0 |
| DaYun calculation service | Missing | P1 |
| Frontend action handling | Missing | P1 |
| Tool result rendering | Missing | P1 |

### Sources

- [Anthropic Tool Use Documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use)
- [Anthropic Streaming with Tools](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Vercel AI SDK](https://vercel.com/blog/ai-sdk-5)
- [LLM Agent Orchestration Guide](https://www.ibm.com/think/tutorials/llm-agent-orchestration-with-langchain-and-granite)
- [Skills vs Tools Architecture](https://blog.arcade.dev/what-are-agent-skills-and-tools)
