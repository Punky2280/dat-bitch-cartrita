"""
Startup checks for Cartrita Python backend.
Performs environment, dependency, and runtime capability verification.
"""

from __future__ import annotations

import os
import shutil
import logging
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, Optional


logger = logging.getLogger(__name__)


@dataclass
class CheckResult:
    name: str
    ok: bool
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "ok": self.ok, "details": self.details}


def _check_env() -> CheckResult:
    required_vars = [
        "OPENAI_API_KEY",
    ]
    present = {k: (os.getenv(k) is not None) for k in required_vars}
    weak = {}
    if os.getenv("OPENAI_API_KEY") and len(os.getenv("OPENAI_API_KEY", "").strip()) < 10:
        weak["OPENAI_API_KEY"] = True

    # Determine which .env was loaded if python-dotenv used
    loaded_from: Optional[str] = os.getenv("CARTRITA_ENV_LOADED_FROM")

    return CheckResult(
        name="environment",
        ok=all(present.values()) and not weak,
        details={
            "present": present,
            "weak": weak,
            "loaded_from": loaded_from,
        },
    )


def _check_qiskit(py_dir: Path) -> CheckResult:
    shadow_file = (py_dir / "qiskit")
    shadowing = shadow_file.is_file()
    version = None
    available = False
    error: Optional[str] = None
    if shadowing:
        # Attempt safe auto-removal if this is a tiny placeholder file
        try:
            size = shadow_file.stat().st_size
            if size <= 64:
                content = shadow_file.read_text(encoding="utf-8", errors="ignore").strip()
                if content.lower() == "qiskit" or content == "":
                    shadow_file.unlink(missing_ok=True)
                    shadowing = False
        except Exception as e:  # pragma: no cover
            logger.warning("Failed to auto-remove qiskit shadow file: %s", e)
        if shadowing:
            error = f"Found file shadowing qiskit import at: {shadow_file}"
    else:
        try:
            import qiskit  # type: ignore

            version = getattr(qiskit, "__version__", None)
            available = True
        except Exception as e:  # pragma: no cover
            error = str(e)

    return CheckResult(
        name="qiskit",
        ok=available and not shadowing,
        details={
            "available": available,
            "version": version,
            "shadowing": shadowing,
            "shadow_path": str(shadow_file) if shadowing else None,
            "error": error,
        },
    )


def _check_ffmpeg() -> CheckResult:
    path = shutil.which("ffmpeg")
    return CheckResult(
        name="ffmpeg",
        ok=bool(path),
        details={"path": path},
    )


def _check_display_headless() -> CheckResult:
    display = os.getenv("DISPLAY")
    xauth = os.getenv("XAUTHORITY")
    mpl = os.getenv("MPLBACKEND")
    headless_ok = mpl == "Agg" or display is None
    return CheckResult(
        name="display",
        ok=headless_ok,
        details={
            "DISPLAY": display,
            "XAUTHORITY": xauth,
            "MPLBACKEND": mpl,
            "note": "Headless OK if MPLBACKEND=Agg or DISPLAY unset",
        },
    )


def run_startup_checks() -> Dict[str, Any]:
    """Run all startup checks and return a diagnostics report."""
    py_dir = Path(__file__).parent
    checks = [
        _check_env(),
        _check_qiskit(py_dir),
        _check_ffmpeg(),
        _check_display_headless(),
    ]
    report = {
        "ok": all(c.ok for c in checks),
        "checks": [c.to_dict() for c in checks],
    }
    # Log a concise summary
    for c in checks:
        logger.info("[StartupCheck] %s => %s", c.name, "OK" if c.ok else "FAIL")
        if not c.ok:
            logger.warning("[StartupCheck] %s details: %s", c.name, c.details)
    return report
