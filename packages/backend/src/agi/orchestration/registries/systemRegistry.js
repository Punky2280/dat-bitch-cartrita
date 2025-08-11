// systemRegistry: registers core lightweight system tools.
import { z } from 'zod';

export async function registerSystemTools(registry) {
  registry.registerTool({
    name: 'getCurrentDateTime',
    description: 'Get the current date and time in Eastern timezone',
    category: 'system',
    schema: z.object({
      format: z.enum(['ISO','eastern','friendly']).optional().default('ISO')
        .describe('Optional format string (default: ISO | eastern | friendly)')
    }),
    func: async ({ format = 'ISO' }) => {
      const now = new Date();
      const easternTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(now);
      if (format === 'ISO') return now.toISOString();
      if (format === 'eastern') return easternTime;
      if (format === 'friendly') {
        return now.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      }
      return now.toISOString();
    }
  });
  registry.registerTool({
    name: 'getSystemStatus',
    description: 'Check the system operational status and basic metrics',
    category: 'system',
    schema: z.object({}),
    func: async () => ({
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      version: '2.1.0-hierarchical',
      tools_available: registry.tools.size,
      healthy: true
    })
  });
}
export default registerSystemTools;
