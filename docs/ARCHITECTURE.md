# Architecture

## Overview

Artifacts Dashboard is a monorepo with a Python/FastAPI backend and Next.js frontend, connected via REST API and WebSocket.

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│ Artifacts API│
│  (Next.js)   │◀────│  (FastAPI)   │◀────│              │
└─────────────┘ WS  └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    └──────────────┘
```

## Backend

### Layers

1. **API Layer** (`app/api/`) — FastAPI routes, request/response handling
2. **Service Layer** (`app/services/`) — business logic, external API communication
3. **Engine Layer** (`app/engine/`) — automation engine with strategies and decision modules
4. **Data Layer** (`app/models/`) — SQLAlchemy models, database access

### Key Patterns

- **Strategy Pattern** — each automation type (combat, gathering, crafting, trading, task) implements a common interface
- **State Machine** — strategies operate as state machines (e.g., move → fight → heal → deposit → repeat)
- **Token Bucket** — rate limiting shared across all automation runners
- **Event Bus** — asyncio pub/sub connecting engine events with WebSocket relay
- **A* Pathfinding** — map navigation using cached tile data

### Automation Engine

```
AutomationManager
├── AutomationRunner (per character)
│   ├── Strategy (combat/gathering/crafting/trading/task)
│   ├── CooldownTracker
│   └── RateLimiter (shared)
└── Coordinator (multi-character)
```

## Frontend

- **App Router** — file-based routing with layouts
- **TanStack Query** — server state management with WebSocket-driven invalidation
- **shadcn/ui** — component library built on Radix UI
- **Recharts** — analytics charts

## Database

| Table | Purpose |
|-------|---------|
| `game_data_cache` | Cached static game data |
| `character_snapshots` | Periodic character state snapshots |
| `automation_configs` | Automation configurations |
| `automation_runs` | Automation execution state |
| `automation_logs` | Action logs |
| `price_history` | Grand Exchange price history |
| `event_log` | Game event history |
