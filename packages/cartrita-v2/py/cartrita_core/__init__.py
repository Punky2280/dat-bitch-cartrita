"""
Cartrita V2 - Core Python Agent Framework
OpenAI Agents SDK + FastAPI Integration
2025 Multi-Agent Operating System
"""

__version__ = "2.0.0"
__author__ = "Robbie Allen"

from .cartrita_agent import CartritaCoreAgent
from .agent_manager import CartritaAgentManager
from .tools import CartritaToolRegistry
from .responses_api import CartritaResponsesClient

__all__ = [
    "CartritaCoreAgent",
    "CartritaAgentManager", 
    "CartritaToolRegistry",
    "CartritaResponsesClient"
]