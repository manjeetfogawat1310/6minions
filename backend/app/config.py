from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Honey Chain"
    app_env: str = "development"
    debug: bool = True
    database_url: str = "sqlite:///./honey_chain.db"
    ai_service_url: str = "http://localhost:8001"
    mock_ai_mode: bool = True
    ai_timeout_seconds: int = 8
    blockchain_rpc_url: str = "http://127.0.0.1:8545"
    blockchain_chain_id: int = 31337
    blockchain_private_key: str = ""
    blockchain_contract_address: str = ""
    blockchain_artifact_path: str = "blockchain/artifacts/HoneyTraceability.json"
    blockchain_required: bool = False
    blockchain_confirmations: int = 1
    public_base_url: str = "http://localhost:8000"
    qr_directory: str = "backend/generated_qr"
    upload_directory: str = "backend/uploads"
    max_report_size_bytes: int = 5242880
    cors_origins: str = "http://localhost:8000,http://127.0.0.1:8000"
    model_config = SettingsConfigDict(env_file='.env', extra='ignore', case_sensitive=False)
    @property
    def cors_origin_list(self): return [x.strip() for x in self.cors_origins.split(',') if x.strip()]
    @property
    def artifact_path(self): return Path(self.blockchain_artifact_path)
    @property
    def qr_path(self): return Path(self.qr_directory)
    @property
    def upload_path(self): return Path(self.upload_directory)

@lru_cache
def get_settings(): return Settings()
