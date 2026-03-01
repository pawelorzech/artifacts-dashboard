# Deployment

## Docker Compose (Production)

```bash
cp .env.example .env
# Edit .env with production values
docker compose -f docker-compose.prod.yml up -d
```

## Coolify

1. Connect your GitHub repository in Coolify
2. Set environment variables in the Coolify dashboard
3. Deploy — Coolify will build from `docker-compose.prod.yml`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ARTIFACTS_TOKEN` | Yes | Your Artifacts MMO API token |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CORS_ORIGINS` | No | Allowed CORS origins (JSON array) |
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL for frontend |
