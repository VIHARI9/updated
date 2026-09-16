from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
OR_SOURCE_FIELD = "erq_rejection"


class Settings(BaseSettings):
    data_dir: Path = BACKEND_DIR / "data"
    sap_script: Path = BACKEND_DIR / "scripts" / "sap_refresh.vbs"
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")


settings = Settings()
