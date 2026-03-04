from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    artifacts_token: str = ""
    database_url: str = "postgresql+asyncpg://artifacts:artifacts@db:5432/artifacts"
    cors_origins: list[str] = ["http://localhost:3000"]

    # Artifacts API
    artifacts_api_url: str = "https://api.artifactsmmo.com"

    # Rate limits (matching Artifacts API: 20 actions/2s, 20 data/1s)
    action_rate_limit: int = 20  # actions per window
    action_rate_window: float = 2.0  # seconds
    data_rate_limit: int = 20  # data requests per window
    data_rate_window: float = 1.0  # seconds

    # Observability
    sentry_dsn: str = ""
    environment: str = "development"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
