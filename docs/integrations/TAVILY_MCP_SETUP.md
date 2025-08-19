# Tavily MCP Integration Setup

This document provides setup instructions for integrating Tavily Expert web search capabilities with GitHub Copilot.

## Configuration

### GitHub Copilot MCP Settings

**Configuration file path**: `~/.github/copilot/mcp.json`

**Configuration content**:

```json
{
  "mcpServers": {
    "Tavily Expert": {
      "serverUrl": "https://tavily.api.tadata.com/mcp/tavily/woodwind-hellish-sombrero-n9w36a"
    }
  }
}
```

### Setup Steps

1. **Open MCP Settings in GitHub Copilot**
   - In VS Code, open Settings (Cmd+, on Mac or Ctrl+, on Windows/Linux)
   - Search for "Copilot" and find "Copilot MCP" settings
   - Click "Edit in settings.json" and add the server configuration under "mcpManager.servers"

2. **Create Configuration File**

   ```bash
   mkdir -p ~/.github/copilot
   echo '{
     "mcpServers": {
       "Tavily Expert": {
         "serverUrl": "https://tavily.api.tadata.com/mcp/tavily/woodwind-hellish-sombrero-n9w36a"
       }
     }
   }' > ~/.github/copilot/mcp.json
   ```

3. **Restart GitHub Copilot**
   - After saving the configuration, restart GitHub Copilot to apply changes
   - The MCP will be available after restart

## Usage Recommendations

- For best results, use Claude Sonnet 3.7 with this MCP
- The MCP name (Tavily Expert) can be edited in the configuration but should remain indicative of its function
- This URL is paired with your API key and should be treated as a secret

## Security Notice

⚠️ **Important**: The serverUrl contains sensitive credentials and should be treated like a password. Do not commit this to public repositories.

## Project Integration

This configuration enables context-aware web search capabilities for our 60-task implementation plan, allowing for:

- Real-time web research during development decisions
- Validation of security patterns and best practices
- Technology stack research and implementation guidance
- Performance optimization research