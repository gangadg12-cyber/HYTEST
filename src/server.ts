import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';
import { findFacilities, prepareBooking } from './facilities.js';
import { SERVICE_NAME, SERVICE_NAME_KO } from './medicalData.js';
import { analyzeSymptoms, buildHandoffSummary, buildObservationChecklist, triageSymptoms } from './triage.js';

function jsonText(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'child-safety-guide-mcp',
      version: '0.1.0'
    },
    {
      instructions:
        'Use Child Safety Guide tools to structure pediatric symptoms, check rule-based urgency, prepare handoff summaries, and connect users to emergency or pediatric care. Never present outputs as a diagnosis or prescription.'
    }
  );

  server.registerTool(
    'analyze_child_symptoms',
    {
      title: 'Analyze Child Symptoms',
      description: `Analyzes Korean natural-language pediatric symptom text with ${SERVICE_NAME}(${SERVICE_NAME_KO}) and extracts age, fever, symptom categories, body parts, red flags, and missing questions. This is not a diagnosis.`,
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Korean natural-language description of a child symptom situation.'),
        childAgeMonths: z.number().int().min(0).max(216).optional().describe('Optional child age in months if known.'),
        temperatureC: z.number().min(30).max(45).optional().describe('Optional measured body temperature in Celsius.')
      },
      annotations: {
        title: 'Analyze Child Symptoms',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text, childAgeMonths, temperatureC }) => jsonText(analyzeSymptoms({ text, childAgeMonths, temperatureC }))
  );

  server.registerTool(
    'triage_child_urgency',
    {
      title: 'Triage Child Urgency',
      description: `Classifies pediatric symptom urgency with ${SERVICE_NAME}(${SERVICE_NAME_KO}) using deterministic red-flag rules. Returns 119, ER, urgent pediatric care, outpatient, or observation guidance without diagnosing.`,
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Korean natural-language child symptom description.'),
        childAgeMonths: z.number().int().min(0).max(216).optional().describe('Optional child age in months.'),
        temperatureC: z.number().min(30).max(45).optional().describe('Optional measured body temperature in Celsius.')
      },
      annotations: {
        title: 'Triage Child Urgency',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text, childAgeMonths, temperatureC }) => jsonText(triageSymptoms({ text, childAgeMonths, temperatureC }))
  );

  server.registerTool(
    'find_child_medical_facilities',
    {
      title: 'Find Child Medical Facilities',
      description: `Finds or prepares lookup links for nearby Korean emergency rooms, pediatric clinics, moonlight pediatric hospitals, or specialty clinics with ${SERVICE_NAME}(${SERVICE_NAME_KO}). Uses public emergency data when configured.`,
      inputSchema: {
        location: z.string().min(2).max(100).describe('Korean location such as 서울 강남구, 경기 성남시 분당구, or a nearby landmark.'),
        need: z
          .enum(['emergency_room', 'pediatric_clinic', 'moonlight_clinic', 'specialty_clinic'])
          .optional()
          .describe('Optional facility type. If omitted, the server infers ER, moonlight pediatric clinic, or pediatric clinic from symptomText.'),
        symptomText: z.string().min(2).max(2000).optional().describe('Optional symptom text used to infer specialty.')
      },
      annotations: {
        title: 'Find Child Medical Facilities',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false
      }
    },
    async ({ location, need, symptomText }) => jsonText(await findFacilities({ location, need, symptomText }))
  );

  server.registerTool(
    'prepare_medical_handoff_summary',
    {
      title: 'Prepare Medical Handoff Summary',
      description: `Creates a concise Korean symptom handoff summary for 119, hospitals, booking calls, or public pediatric consultation services using ${SERVICE_NAME}(${SERVICE_NAME_KO}).`,
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Child symptom description to summarize.'),
        childAgeMonths: z.number().int().min(0).max(216).optional().describe('Optional child age in months.'),
        temperatureC: z.number().min(30).max(45).optional().describe('Optional measured body temperature in Celsius.'),
        destination: z.enum(['119', 'hospital', 'icaretok', 'booking']).optional().describe('Where the handoff summary will be used.')
      },
      annotations: {
        title: 'Prepare Medical Handoff Summary',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text, childAgeMonths, temperatureC, destination }) =>
      jsonText({
        summary: buildHandoffSummary({ text, childAgeMonths, temperatureC, destination })
      })
  );

  server.registerTool(
    'get_observation_checklist',
    {
      title: 'Get Observation Checklist',
      description: `Returns a concise Korean observation checklist and worsening signs for a child symptom category using ${SERVICE_NAME}(${SERVICE_NAME_KO}). This does not replace medical care.`,
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Child symptom description.'),
        childAgeMonths: z.number().int().min(0).max(216).optional().describe('Optional child age in months.'),
        temperatureC: z.number().min(30).max(45).optional().describe('Optional measured body temperature in Celsius.')
      },
      annotations: {
        title: 'Get Observation Checklist',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text, childAgeMonths, temperatureC }) => {
      const parsed = analyzeSymptoms({ text, childAgeMonths, temperatureC });
      return jsonText({
        checklist: buildObservationChecklist(parsed),
        missingQuestions: parsed.missingQuestions
      });
    }
  );

  server.registerTool(
    'request_or_prepare_booking',
    {
      title: 'Request Or Prepare Booking',
      description: `Prepares a pediatric booking or phone inquiry request with ${SERVICE_NAME}(${SERVICE_NAME_KO}). It does not make a real reservation unless a partner booking API is added later.`,
      inputSchema: {
        symptomText: z.string().min(2).max(2000).describe('Child symptom description for the booking or phone inquiry.'),
        location: z.string().min(2).max(100).optional().describe('Optional Korean location for finding nearby facilities.'),
        hospitalName: z.string().min(2).max(100).optional().describe('Optional target hospital or clinic name.'),
        preferredTime: z.string().min(2).max(100).optional().describe('Optional preferred visit time.'),
        contactMethod: z.enum(['phone', 'web', 'unknown']).optional().describe('Preferred booking contact method.')
      },
      annotations: {
        title: 'Request Or Prepare Booking',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false
      }
    },
    async ({ symptomText, location, hospitalName, preferredTime, contactMethod }) =>
      jsonText(prepareBooking({ symptomText, location, hospitalName, preferredTime, contactMethod }))
  );

  return server;
}

const app = createMcpExpressApp({ host: '0.0.0.0' });

app.get('/', (_req: Request, res: Response) => {
  res.type('text/plain').send(`${SERVICE_NAME} MCP server is running. Use POST /mcp for MCP requests.`);
});

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'child-safety-guide-mcp' });
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
  console.log(`${SERVICE_NAME} MCP server listening on port ${port}`);
});
