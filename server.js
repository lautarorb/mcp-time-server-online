#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const http = require('http');

class TimeServer {
  constructor() {
    this.server = new Server(
      {
        name: 'time-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_current_time',
            description: 'Get the current date and time for any location',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  description: 'Time format preference (iso, locale, or timestamp)',
                  enum: ['iso', 'locale', 'timestamp'],
                  default: 'locale'
                },
                timezone: {
                  type: 'string',
                  description: 'Timezone (e.g., America/Argentina/Buenos_Aires, America/New_York, Europe/London, UTC)',
                  default: 'America/Argentina/Buenos_Aires'
                }
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_current_time':
          return await this.getCurrentTime(request.params.arguments);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async getCurrentTime(args) {
    const { format = 'locale', timezone = 'America/Argentina/Buenos_Aires' } = args || {};
    
    try {
      const now = new Date();
      let timeString;

      switch (format) {
        case 'iso':
          if (timezone === 'UTC') {
            timeString = now.toISOString();
          } else {
            // Get time in specified timezone
            const options = { timeZone: timezone };
            const localTime = new Date(now.toLocaleString('en-CA', options));
            timeString = localTime.toISOString();
          }
          break;
        case 'locale':
          timeString = now.toLocaleString('es-AR', { 
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          });
          break;
        case 'timestamp':
          timeString = now.getTime().toString();
          break;
        default:
          timeString = now.toLocaleString('es-AR', { 
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          });
      }

      const locationName = timezone.includes('Argentina') ? 'Argentina' : timezone.replace(/_/g, ' ').split('/').pop();
      
      return {
        content: [
          {
            type: 'text',
            text: `Current time in ${locationName}: ${timeString}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting time: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Time MCP server running on stdio');
  }

  // Add HTTP server for online access
  setupHttpServer() {
    const port = process.env.PORT || 3000;
    
    const httpServer = http.createServer(async (req, res) => {
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      
      if (req.method === 'OPTIONS') {
        res.end();
        return;
      }
      
      if (req.url === '/time' || req.url === '/') {
        try {
          const result = await this.getCurrentTime();
          res.end(JSON.stringify({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          res.end(JSON.stringify({
            success: false,
            error: error.message
          }));
        }
      } else if (req.url === '/health') {
        res.end(JSON.stringify({
          status: 'healthy',
          service: 'MCP Time Server',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ 
          success: false,
          error: 'Endpoint not found. Try /time or /health' 
        }));
      }
    });
    
    httpServer.listen(port, () => {
      console.log(`HTTP server running on port ${port}`);
      console.log(`Access your server at: http://localhost:${port}/time`);
    });
  }
}

// Server startup logic
const server = new TimeServer();

// For Railway/online deployment (HTTP)
if (process.env.PORT || process.argv.includes('--http')) {
  server.setupHttpServer();
} else {
  // For local MCP (stdio)
  server.run().catch(console.error);
}
