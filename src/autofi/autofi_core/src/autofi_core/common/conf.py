from pydantic_settings import BaseSettings
import tomli
from langchain_mcp_adapters.sessions import StdioConnection
from pathlib import Path
from typing import Any


class ServerConfig(BaseSettings):
    debug: bool


class NatsConfig(BaseSettings):
    url: str
    timeout: int
    async_response_timeout: int


class RedisConfig(BaseSettings):
    url: str | list[str]
    password: str


class VaultConfig(BaseSettings):
    url: str


class LLMConfig(BaseSettings):
    investment_expert_model: str
    operator_model: str
    thread_id: str
    cron_interval: int


class MongoConfig(BaseSettings):
    url: str


class HelperConfig(BaseSettings):
    command: str
    args: list[str]
    cwd: str | Path | None = None
    env: dict[str, str] | None = None


class MCPConfig(BaseSettings):
    investment_expert_helper: HelperConfig
    operator_helper: HelperConfig


class CDPConfig(BaseSettings):
    paymaster_url: str


class AppConfig(BaseSettings):
    server: ServerConfig
    nats: NatsConfig
    redis: RedisConfig
    vault: VaultConfig
    llm: LLMConfig
    mongo: MongoConfig
    mcp: MCPConfig
    cdp: CDPConfig


def load_toml_config(config_files: str) -> dict:
    with open(config_files, mode="rb") as f:
        return tomli.load(f)


def get_config() -> AppConfig:
    config_files = './config/config.toml'
    toml_config = load_toml_config(config_files)
    app_config = AppConfig(**toml_config)
    return app_config


config = get_config()


def mcp_config_to_stdio(
    mcp_item,  # MCPHelperConfig/MCPFeedbackConfig/MCPTavilyConfig
    *,
    encoding: str = "utf-8",
    session_kwargs: dict[str, Any] | None = None
) -> StdioConnection:
    return {
        "transport": "stdio",
        "command": mcp_item.command,
        "args": mcp_item.args,
        "env": mcp_item.env,
        "cwd": mcp_item.cwd,
        "encoding": encoding,
        "encoding_error_handler": "strict",
        "session_kwargs": session_kwargs,
    }


def build_mcp_config(keys: list[str]) -> dict[str, StdioConnection]:
    return {key: mcp_config_to_stdio(getattr(config.mcp, key)) for key in keys}