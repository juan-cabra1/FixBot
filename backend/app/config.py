# app/config.py — Application settings via pydantic-settings
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./fixbot.db"
    gemini_api_key: str
    whapi_token: str
    whapi_api_url: str = "https://gate.whapi.cloud"
    port: int = 8000
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    debounce_seconds: int = 40
    jwt_secret: str = "change-me-in-production"
    dashboard_user: str = "admin"
    dashboard_password_hash: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
