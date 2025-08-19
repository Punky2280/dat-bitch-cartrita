#!/bin/bash

# Setup script for Tavily MCP integration with GitHub Copilot
# This script configures context-aware web search capabilities

echo "🔍 Setting up Tavily MCP integration for GitHub Copilot..."

# Create GitHub Copilot config directory
mkdir -p ~/.github/copilot

# Copy MCP configuration
cp config/github-copilot-mcp.json ~/.github/copilot/mcp.json

echo "✅ Tavily MCP configuration installed to ~/.github/copilot/mcp.json"
echo ""
echo "📋 Next steps:"
echo "1. Restart GitHub Copilot in VS Code"
echo "2. The MCP will be available after restart"
echo "3. Use for context-aware web research during development"
echo ""
echo "⚠️  Security Notice:"
echo "The configuration contains sensitive API credentials."
echo "Do not share or commit the serverUrl to public repositories."
echo ""
echo "🎯 Ready to enhance the 60-task implementation plan with web search capabilities!"