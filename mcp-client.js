#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

class TimeServerClient {
  constructor() {
    this.railwayUrl = 'https://mcp-time-server-online-production.up.railway.app/time';
    
    this.server = new Server(
      {
        name: 'argentina-time-client',
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
            name: 'get_argentina_time',
            description: 'Get the current time in Argentina',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'get_argentina_time':
          return await this.getArgentinaTime();
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async getArgentinaTime() {
    try {
      const response = await fetch(this.railwayUrl);
      const data = await response.json();
      
      if (data.success && data.data && data.data.content && data.data.content[0]) {
        return {
          content: [
            {
              type: 'text',
              text: data.data.content[0].text
            }
          ]
        };
      } else {
        throw new Error('Invalid response format from time server');
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting Argentina time: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Argentina Time MCP client running');
  }
}

const client = new TimeServerClient();
client.run().catch(console.error);
