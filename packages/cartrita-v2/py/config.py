"""
Centralized configuration for Cartrita Python backend (OpenAI, providers, runtime).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional, Dict, Any


def _read_secret(env_key: str, file_key: Optional[str] = None) -> Optional[str]:
    """Read secret from env or file path (Docker/K8s secrets pattern)."""
    val = os.getenv(env_key)
    if val:
        return val
    if file_key:
        path = os.getenv(file_key)
        if path and os.path.isfile(path):  # type: ignore[attr-defined]
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            except Exception:
                return None
    return None


def mask_secret(secret: Optional[str], keep: int = 4) -> Optional[str]:
    if not secret:
        return None
    s = secret.strip()
    if len(s) <= keep:
        return "*" * len(s)
    return ("*" * (len(s) - keep)) + s[-keep:]


@dataclass
class OpenAISettings:
    api_key: Optional[str]
    organization: Optional[str]
    project: Optional[str]
    base_url: Optional[str]
    default_model: str
    timeout: float

    @classmethod
    def load(cls) -> "OpenAISettings":
        api_key = _read_secret("OPENAI_API_KEY", "OPENAI_API_KEY_FILE") or _read_secret(
            "OPENAI_FINETUNING_API_KEY", "OPENAI_FINETUNING_API_KEY_FILE"
        )
        return cls(
            api_key=api_key,
            organization=os.getenv("OPENAI_ORG") or os.getenv("OPENAI_ORGANIZATION"),
            project=os.getenv("OPENAI_PROJECT"),
            base_url=os.getenv("OPENAI_BASE_URL"),
            default_model=os.getenv("OPENAI_DEFAULT_MODEL", "gpt-5"),
            timeout=float(os.getenv("OPENAI_TIMEOUT", "60")),
        )

    def client_kwargs(self) -> Dict[str, Any]:
        kwargs: Dict[str, Any] = {}
        if self.api_key:
            kwargs["api_key"] = self.api_key
        if self.organization:
            kwargs["organization"] = self.organization
        if self.project:
            kwargs["project"] = self.project
        if self.base_url:
            kwargs["base_url"] = self.base_url
        return kwargs


@dataclass
class RuntimeSettings:
    environment: str
    env_loaded_from: Optional[str]

    @classmethod
    def load(cls) -> "RuntimeSettings":
        return cls(
            environment=os.getenv("ENVIRONMENT", "development"),
            env_loaded_from=os.getenv("CARTRITA_ENV_LOADED_FROM"),
        )


def get_settings() -> Dict[str, Any]:
    oa = OpenAISettings.load()
    rt = RuntimeSettings.load()
    return {
        "openai": oa,
        "runtime": rt,
        "safe": {
            "openai": {
                "api_key": mask_secret(oa.api_key),
                "organization": oa.organization,
                "project": oa.project,
                "base_url": oa.base_url,
                "default_model": oa.default_model,
                "timeout": oa.timeout,
            },
            "runtime": {
                "environment": rt.environment,
                "env_loaded_from": rt.env_loaded_from,
            },
        },
    }
