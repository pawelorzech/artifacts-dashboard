from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    artifacts_token: str = ""
    database_url: str = "postgresql+asyncpg://artifacts:artifacts@db:5432/artifacts"
    cors_origins: list[str] = ["http://localhost:3000"]

    # Artifacts API
    artifacts_api_url: str = "https://api.artifactsmmo.com"

    # Rate limits
    action_rate_limit: int = 7  # actions per window
    action_rate_window: float = 2.0  # seconds
    data_rate_limit: int = 20  # data requests per window
    data_rate_window: float = 1.0  # seconds

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
