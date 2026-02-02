---
title: Widget 系统设计
description: AI 驱动的 Widget 系统 UI/UX 设计
---

# Widget System UI/UX Design

## Concept

The AI can "show" predefined widgets on the left panel by returning special tool results. The frontend interprets these and renders rich, interactive components.

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  User: "明年运势如何？"                                                  │
│                                                                         │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  MiniMax receives message + tools definition                     │   │
│  │  Thinks: "I need to call get_liunian_analysis for 2026"         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Backend executes tool, returns:                                 │   │
│  │  {                                                               │   │
│  │    "widget": "liunian",          ← Widget type                   │   │
│  │    "data": { year: 2026, ... },  ← Widget props                  │   │
│  │    "text": "2026年是丙午年..."    ← AI explanation               │   │
│  │  }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Frontend:                                                       │   │
│  │  1. Renders widget on LEFT PANEL                                │   │
│  │  2. Shows AI explanation in CHAT                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ☯ 命理                                                    [档案] [设置]     │
├────────────────────────────┬─────────────────────────────────────────────────┤
│                            │                                                 │
│  ┌──────────────────────┐  │           ┌─────────────────────────────┐      │
│  │  八字命盘            │  │           │ 你好！我是智命AI助手...      │      │
│  │  ┌────┬────┬────┬────┐│  │           └─────────────────────────────┘      │
│  │  │年柱│月柱│日柱│时柱││  │                                                 │
│  │  │辛  │丁  │辛  │丁  ││  │           ┌─────────────────────────────┐      │
│  │  │巳  │酉  │丑  │酉  ││  │           │ 明年运势如何？               │ ←You │
│  │  └────┴────┴────┴────┘│  │           └─────────────────────────────┘      │
│  │  日主: 辛金 · 身弱    │  │                                                 │
│  └──────────────────────┘  │           ┌─────────────────────────────┐      │
│                            │           │ 2026年是丙午年，对应你的    │      │
│  ┌──────────────────────┐  │           │ 辛金日主是正财运...         │      │
│  │  五行力量            │  │           │                             │      │
│  │  木 ████░░░░░ 15     │  │           │ 详细分析已显示在左侧面板。  │      │
│  │  火 ██████░░░ 28     │  │           └─────────────────────────────┘      │
│  │  土 ████████░ 35  主 │  │                                                 │
│  │  金 █████░░░░ 22     │  │                                                 │
│  │  水 ██░░░░░░░ 10     │  │                                                 │
│  └──────────────────────┘  │                                                 │
│                            │                                                 │
│  ┌──────────────────────┐  │   ← NEW WIDGET APPEARS HERE                    │
│  │  📅 2026 流年运势     │  │                                                 │
│  │  ─────────────────── │  │                                                 │
│  │  流年: 丙午年         │  │                                                 │
│  │  天干: 丙火 (正财)    │  │                                                 │
│  │  地支: 午火 (正财)    │  │                                                 │
│  │  ─────────────────── │  │                                                 │
│  │  上半年: ████████ 好  │  │                                                 │
│  │  下半年: ██████░░ 中  │  │                                                 │
│  │  ─────────────────── │  │                                                 │
│  │  💰 财运: ★★★★☆       │  │                                                 │
│  │  💼 事业: ★★★☆☆       │  │                                                 │
│  │  ❤️ 感情: ★★★★★       │  │                                                 │
│  │  🏥 健康: ★★★☆☆       │  │                                                 │
│  └──────────────────────┘  │                                                 │
│                            │  ┌─────────────────────────────────────────┐   │
│  [抽塔罗] [今日运势]        │  │ 问问你的命运...                    [发送] │   │
│                            │  └─────────────────────────────────────────┘   │
├────────────────────────────┴─────────────────────────────────────────────────┤
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Predefined Widgets

### 1. `bazi` - 八字命盘 (Already exists)
```typescript
interface BaziWidgetData {
  bazi: string;           // "辛巳 丁酉 辛丑 丁酉"
  dayMaster: string;      // "辛"
  dayMasterWuxing: string; // "金"
  isStrong: boolean;
}
```

### 2. `wuxing` - 五行力量 (Already exists)
```typescript
interface WuxingWidgetData {
  木: number;
  火: number;
  土: number;
  金: number;
  水: number;
  dayMasterWuxing: string;
  beneficialPercent: number;
  harmfulPercent: number;
}
```

### 3. `liunian` - 流年运势 (NEW)
```typescript
interface LiunianWidgetData {
  year: number;
  ganZhi: string;         // "丙午"
  tianGan: string;        // "丙"
  tianGanShishen: string; // "正财"
  diZhi: string;          // "午"
  diZhiShishen: string;   // "正财"
  scores: {
    wealth: number;       // 1-5 stars
    career: number;
    love: number;
    health: number;
  };
  firstHalf: number;      // 0-100 score
  secondHalf: number;
  highlights: string[];   // Key points
}
```

### 4. `dayun` - 大运 (NEW)
```typescript
interface DayunWidgetData {
  cycles: Array<{
    startAge: number;
    endAge: number;
    ganZhi: string;
    element: string;
    isCurrent: boolean;
  }>;
  currentCycle: {
    ganZhi: string;
    yearsRemaining: number;
  };
}
```

### 5. `calendar` - 月历 (NEW)
```typescript
interface CalendarWidgetData {
  year: number;
  month: number;
  days: Array<{
    day: number;
    quality: 'good' | 'neutral' | 'bad';
    score: number;
  }>;
  highlighted?: number[]; // Days to highlight
}
```

### 6. `dayQuality` - 日期分析 (NEW)
```typescript
interface DayQualityWidgetData {
  date: string;
  ganZhi: string;
  score: number;
  label: string;          // "大吉" | "中吉" | "平" | "凶"
  activities: {
    good: string[];       // ["结婚", "开业"]
    bad: string[];        // ["动土", "搬家"]
  };
}
```

### 7. `tarot` - 塔罗牌 (Future)
```typescript
interface TarotWidgetData {
  cards: Array<{
    name: string;
    image: string;
    reversed: boolean;
    meaning: string;
  }>;
  spread: 'single' | 'three' | 'celtic';
}
```

---

## Tool → Widget Mapping

| Tool Name | Widget | Trigger Phrases |
|-----------|--------|-----------------|
| `get_liunian_analysis` | `liunian` | "明年运势", "2026年", "流年" |
| `get_dayun_cycles` | `dayun` | "大运", "十年运", "运势周期" |
| `get_calendar_month` | `calendar` | "这个月", "看日历", "几号好" |
| `get_day_quality` | `dayQuality` | "明天好不好", "这天怎么样" |
| `draw_tarot` | `tarot` | "抽塔罗", "占卜" |

---

## Backend Tool Response Format

```python
# When tool execution returns:
{
    "widget": "liunian",              # Widget type to render
    "data": {                         # Props for the widget
        "year": 2026,
        "ganZhi": "丙午",
        "tianGanShishen": "正财",
        # ... more data
    },
    "summary": "2026年财运不错",       # Short summary for AI
    "detail": "..."                   # Full analysis text
}
```

The AI then responds with something like:
> "2026年是丙午年，我已经在左侧显示了详细的流年分析。简单来说，这一年对你来说财运不错..."

---

## Frontend Implementation

### Widget Registry

```typescript
// components/widgets/index.ts
import { BaziCard } from './bazi-card';
import { WuxingCard } from './wuxing-card';
import { LiunianCard } from './liunian-card';
import { DayunCard } from './dayun-card';
import { CalendarCard } from './calendar-card';
import { DayQualityCard } from './day-quality-card';

export const WIDGET_REGISTRY = {
  bazi: BaziCard,
  wuxing: WuxingCard,
  liunian: LiunianCard,
  dayun: DayunCard,
  calendar: CalendarCard,
  dayQuality: DayQualityCard,
} as const;

export type WidgetType = keyof typeof WIDGET_REGISTRY;
```

### Widget State Management

```typescript
// hooks/use-widgets.ts
interface Widget {
  id: string;
  type: WidgetType;
  data: unknown;
  timestamp: number;
}

interface WidgetState {
  widgets: Widget[];
  addWidget: (type: WidgetType, data: unknown) => void;
  removeWidget: (id: string) => void;
  clearWidgets: () => void;
}

export const useWidgets = create<WidgetState>((set) => ({
  widgets: [],
  addWidget: (type, data) => set((state) => ({
    widgets: [...state.widgets, {
      id: `${type}-${Date.now()}`,
      type,
      data,
      timestamp: Date.now(),
    }]
  })),
  removeWidget: (id) => set((state) => ({
    widgets: state.widgets.filter(w => w.id !== id)
  })),
  clearWidgets: () => set({ widgets: [] }),
}));
```

### Left Panel with Dynamic Widgets

```tsx
// components/dashboard-panel.tsx
function DashboardPanel() {
  const { widgets } = useWidgets();
  const { baziData, wuxingData } = useBaziContext();

  return (
    <aside className="w-[360px] border-r overflow-y-auto">
      {/* Static widgets (always shown after analysis) */}
      {baziData && <BaziCard data={baziData} />}
      {wuxingData && <WuxingCard data={wuxingData} />}

      {/* Dynamic widgets (AI-triggered) */}
      {widgets.map((widget) => {
        const Component = WIDGET_REGISTRY[widget.type];
        return (
          <div key={widget.id} className="animate-in slide-in-from-left">
            <Component data={widget.data} />
          </div>
        );
      })}

      {/* Quick actions */}
      <div className="flex gap-2 p-4">
        <Button variant="outline" size="sm">抽塔罗</Button>
        <Button variant="outline" size="sm">今日运势</Button>
      </div>
    </aside>
  );
}
```

### Handling Tool Results in Chat

```typescript
// In useAgenticChat hook
const handleStreamChunk = (chunk: StreamChunk) => {
  if (chunk.widget) {
    // AI triggered a widget
    addWidget(chunk.widget, chunk.data);
  }

  if (chunk.content) {
    // Regular text content
    appendToMessage(chunk.content);
  }
};
```

---

## Mobile Adaptation

On mobile, widgets appear as **horizontal scroll cards** below the chat:

```
┌─────────────────────────────────┐
│  Chat messages...               │
│                                 │
│  ┌─────────────────────────┐   │
│  │ AI: 2026年流年分析...    │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│  ← [八字] [五行] [流年] [大运] →│  ← Horizontal scroll
├─────────────────────────────────┤
│  [输入框]               [发送]  │
└─────────────────────────────────┘
```

---

## Animation & Transitions

When a new widget appears:

1. **Slide in from left** (desktop) or **slide up** (mobile)
2. **Highlight glow** for 2 seconds
3. **Scroll into view** if needed

```css
@keyframes widget-appear {
  0% { opacity: 0; transform: translateX(-20px); }
  100% { opacity: 1; transform: translateX(0); }
}

.widget-new {
  animation: widget-appear 0.3s ease-out;
  box-shadow: 0 0 0 2px var(--primary);
}
```

---

## Summary

| Component | Responsibility |
|-----------|---------------|
| **MiniMax** | Decides when to call tools based on user query |
| **Backend** | Executes tools, returns `{widget, data, summary}` |
| **Frontend** | Renders widgets, manages state, handles animations |
| **Widget Registry** | Maps widget types to React components |

The AI doesn't directly "control" the frontend—it returns structured data, and the frontend interprets it.
