from pydantic_settings import BaseSettings
import tomli
from langchain_mcp_adapters.sessions import StdioConnection
from pathlib import Path
from typing import Any


class AgentConfig(BaseSettings):
    risk_api_uri: str


class HelperConfig(BaseSettings):
    command: str
    args: list[str]
    cwd: str | Path | None = None
    env: dict[str, str] | None = None


class MCPConfig(BaseSettings):
    risk_analyst_helper: HelperConfig


class AppConfig(BaseSettings):
    agent: AgentConfig
    mcp: MCPConfig


def load_toml_config(config_files: str) -> dict:
    with open(config_files, mode="rb") as f:
        return tomli.load(f)


def get_config() -> AppConfig:
    config_files = './config/uagent_config.toml'
    toml_config = load_toml_config(config_files)
    app_config = AppConfig(**toml_config)
    return app_config


config = get_config()


def mcp_config_to_stdio(
    mcp_item,  # risk_analyst_helper
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
