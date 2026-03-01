# API Reference

Base URL: `http://localhost:8000`

## Health

### `GET /health`
Returns service health status.

## Characters

### `GET /api/characters`
List all characters with current state.

### `GET /api/characters/{name}`
Get detailed character info including equipment, inventory, and skills.

## Game Data

### `GET /api/game/items`
All game items (cached).

### `GET /api/game/monsters`
All monsters (cached).

### `GET /api/game/resources`
All resources (cached).

### `GET /api/game/maps`
All map tiles (cached).

## Dashboard

### `GET /api/dashboard`
Aggregated dashboard data for all characters.

## Automations

### `GET /api/automations`
List all automation configs.

### `POST /api/automations`
Create a new automation.

### `POST /api/automations/{id}/start`
Start an automation.

### `POST /api/automations/{id}/stop`
Stop an automation.

### `POST /api/automations/{id}/pause`
Pause an automation.

### `POST /api/automations/{id}/resume`
Resume a paused automation.

## Bank

### `GET /api/bank`
Bank contents with item details.

## Exchange

### `GET /api/exchange/orders`
Active GE orders.

### `GET /api/exchange/prices/{item_code}`
Price history for an item.

## Events

### `GET /api/events`
Active and historical game events.

## WebSocket

### `WS /ws/live`
Real-time event stream (character updates, automation status, game events).
