import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';

const SERVICE_NAME = 'HYTEST';
const SERVICE_NAME_KO = 'HYTEST';

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'hytest-mcp-server',
      version: '0.1.0'
    },
    {
      instructions:
        'Use these HYTEST tools for small, deterministic test utilities. Keep responses concise.'
    }
  );

  server.registerTool(
    'get_server_time',
    {
      title: 'Get Server Time',
      description: `Returns the current server time from ${SERVICE_NAME}(${SERVICE_NAME_KO}) in ISO 8601 format.`,
      inputSchema: {
        timezone: z
          .string()
          .optional()
          .describe('Optional IANA timezone such as Asia/Seoul or UTC.')
      },
      annotations: {
        title: 'Get Server Time',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: false
      }
    },
    async ({ timezone }) => {
      const now = new Date();
      const resolvedTimezone = timezone?.trim() || 'UTC';
      let localized = '';

      try {
        localized = new Intl.DateTimeFormat('en-US', {
          timeZone: resolvedTimezone,
          dateStyle: 'full',
          timeStyle: 'long'
        }).format(now);
      } catch {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Invalid timezone: ${resolvedTimezone}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                iso: now.toISOString(),
                timezone: resolvedTimezone,
                localized
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  server.registerTool(
    'echo_message',
    {
      title: 'Echo Message',
      description: `Echoes a short message through ${SERVICE_NAME}(${SERVICE_NAME_KO}) for MCP connectivity testing.`,
      inputSchema: {
        message: z.string().min(1).max(500).describe('Short text to echo back.')
      },
      annotations: {
        title: 'Echo Message',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ message }) => {
      return {
        content: [
          {
            type: 'text',
            text: message
          }
        ]
      };
    }
  );

  server.registerTool(
    'count_characters',
    {
      title: 'Count Characters',
      description: `Counts characters, words, and lines in text using ${SERVICE_NAME}(${SERVICE_NAME_KO}).`,
      inputSchema: {
        text: z.string().min(1).max(4000).describe('Text to inspect.')
      },
      annotations: {
        title: 'Count Characters',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text }) => {
      const trimmed = text.trim();
      const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/u).length;
      const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              characters: [...text].length,
              words,
              lines
            })
          }
        ]
      };
    }
  );

  return server;
}

const app = createMcpExpressApp({ host: '0.0.0.0' });

app.get('/', (_req: Request, res: Response) => {
  res.type('text/plain').send('HYTEST MCP server is running. Use POST /mcp for MCP requests.');
});

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'hytest-mcp-server' });
});

app.post('/mcp', async (req: Request, res: Response) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    await transport.close();
    await server.close();
  };

  res.on('finish', () => {
    void cleanup();
  });
  res.on('close', () => {
    void cleanup();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
    await cleanup();
  }
});

app.get('/mcp', (_req: Request, res: Response) => {
  res
    .status(405)
    .set('Allow', 'POST')
    .json({ error: 'This stateless MCP server accepts POST requests at /mcp.' });
});

app.delete('/mcp', (_req: Request, res: Response) => {
  res
    .status(405)
    .set('Allow', 'POST')
    .json({ error: 'This stateless MCP server does not keep sessions.' });
});

const port = Number.parseInt(process.env.PORT ?? process.env.MCP_PORT ?? '3000', 10);

app.listen(port, '0.0.0.0', () => {
  console.log(`HYTEST MCP server listening on port ${port}`);
});
