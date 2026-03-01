# Artifacts MMO Dashboard

> Dashboard & automation platform for [Artifacts MMO](https://artifactsmmo.com) — control, automate, and analyze your characters through a beautiful web interface.

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Live Character Dashboard** — real-time view of all 5 characters with HP, stats, equipment, inventory, skills, and cooldowns
- **Automation Engine** — combat, gathering, crafting, trading, and task automation with configurable strategies
- **Interactive Map** — world map with character positions, monsters, resources, and event overlays
- **Bank Management** — searchable bank inventory with item details and estimated values
- **Grand Exchange** — market browsing, order management, and price history charts
- **Event Tracking** — live game events with notifications
- **Analytics** — XP gain, gold tracking, actions/hour, and level progression charts
- **Multi-Character Coordination** — resource pipelines, boss fights, and task distribution
- **WebSocket Updates** — real-time dashboard updates via game WebSocket relay

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, Recharts |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), httpx, Pydantic v2 |
| Database | PostgreSQL 17 |
| Deployment | Docker Compose, Coolify |

## Quickstart

### Prerequisites

- Docker & Docker Compose
- An [Artifacts MMO](https://artifactsmmo.com) account and API token

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/artifacts-dashboard.git
   cd artifacts-dashboard
   ```

2. Copy the environment file and add your API token:
   ```bash
   cp .env.example .env
   # Edit .env and set ARTIFACTS_TOKEN
   ```

3. Start the stack:
   ```bash
   docker compose up
   ```

4. Open your browser:
   - Dashboard: http://localhost:3000
   - API docs: http://localhost:8000/docs

## Project Structure

```
artifacts-dashboard/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # REST endpoints
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   ├── engine/   # Automation engine
│   │   └── websocket/# WebSocket client & relay
│   └── tests/
├── frontend/         # Next.js application
│   └── src/
│       ├── app/      # Pages (App Router)
│       ├── components/
│       ├── hooks/
│       └── lib/
├── docs/             # Documentation
└── docker-compose.yml
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — system design and patterns
- [Automation](docs/AUTOMATION.md) — strategy configuration guide
- [Deployment](docs/DEPLOYMENT.md) — production deployment with Coolify
- [API Reference](docs/API.md) — backend REST API

## Contributing

Contributions are welcome! Please read the following before submitting:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please use the provided issue and PR templates.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
