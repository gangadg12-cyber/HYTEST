import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';
import { compareUsageScenarios, estimateBill, parseUsageRequest } from './billCalculator.js';
import {
  classifyCivilServiceCatalog,
  getKepcoIntegrationStatus,
  guideCivilService,
  inferCivilServiceType,
  listKepcoCivilServiceCatalog,
  prepareApplicationDraft
} from './civilService.js';
import { planEvChargingVisit } from './evCharging.js';
import { OFFICIAL_DATA_SOURCES, SERVICE_NAME, SERVICE_NAME_KO, SERVICE_VERSION, type CivilServiceType } from './kepcoData.js';

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

const voltageSchema = z.enum(['low_voltage', 'high_voltage']);
const civilServiceSchema = z.enum([
  'name_change',
  'move_settlement',
  'new_connection',
  'contract_change',
  'auto_payment',
  'bill_delivery',
  'welfare_discount',
  'outage_or_danger_report',
  'customer_number_lookup',
  'bill_lookup_or_payment',
  'ev_charger_usage_submission',
  'certificate_or_tax',
  'metering_or_due_date',
  'ppa_or_offset',
  'other',
  'unknown'
]);

const chargerStatusSchema = z.enum(['available', 'charging', 'reserved', 'faulted', 'unknown']);
const chargerCandidateSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(200).optional(),
  routeName: z.string().min(1).max(80).optional(),
  direction: z.string().min(1).max(80).optional(),
  operator: z.string().min(1).max(120).optional(),
  chargerType: z.string().min(1).max(80).optional(),
  connectorType: z.string().min(1).max(80).optional(),
  outputKw: z.number().positive().max(1000).optional(),
  distanceKm: z.number().min(0).max(1000).optional(),
  status: chargerStatusSchema.optional(),
  availableCount: z.number().int().min(0).max(1000).optional(),
  chargingCount: z.number().int().min(0).max(1000).optional(),
  faultedCount: z.number().int().min(0).max(1000).optional(),
  totalCount: z.number().int().min(0).max(1000).optional(),
  statusUpdatedAt: z.string().min(1).max(80).optional(),
  estimatedArrivalMinutes: z.number().min(0).max(1440).optional()
});

function optionalEnvNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVICE_NAME,
      version: SERVICE_VERSION
    },
    {
      instructions:
        'Use KEPCO Electric Agent tools for Korean electricity bill estimation, appliance usage cost simulation, KEPCO civil service routing, and application draft preparation. Do not claim to submit KEPCO 민원, payment, or auto-transfer unless an authenticated KEPCO integration is added.'
    }
  );

  server.registerTool(
    'parse_electricity_usage_request',
    {
      title: 'Parse Electricity Usage Request',
      description:
        'Use when the user asks in Korean about an appliance, electricity usage, kWh, 에어컨/건조기/전기차/히터 usage, or bill increase. Extracts appliance name, power W/kW, hours per day, days per month, current monthly kWh, voltage type, and missing fields before calculation.',
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Korean natural-language electricity usage or bill question.')
      },
      annotations: {
        title: 'Parse Electricity Usage Request',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text }) => jsonText(parseUsageRequest({ text }))
  );

  server.registerTool(
    'estimate_residential_electricity_bill',
    {
      title: 'Estimate Residential Electricity Bill',
      description:
        'Use for Korean questions like "에어컨 1800W 하루 8시간 틀면 전기요금 얼마 늘어?", "월 350kWh 쓰는데 건조기 쓰면?", or "전기차 충전하면 요금?". Calculates additional kWh and estimated residential KEPCO bill increase using deterministic tariff rules. This is an estimate, not an official bill.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language question. The server will extract appliance, watts, hours, days, and base kWh when possible.'),
        applianceName: z.string().min(1).max(80).optional().describe('Optional appliance/product name such as 에어컨 or 건조기.'),
        powerW: z.number().positive().max(100000).optional().describe('Optional appliance power in watts. 1.8kW should be 1800.'),
        hoursPerDay: z.number().positive().max(24).optional().describe('Optional daily usage hours.'),
        daysPerMonth: z.number().positive().max(31).optional().describe('Optional monthly usage days.'),
        baseMonthlyKwh: z.number().min(0).max(10000).optional().describe('Optional current monthly electricity usage in kWh. If omitted, marginal scenarios are returned.'),
        voltageType: voltageSchema.optional().describe('Residential voltage type. Defaults to low_voltage if unknown.'),
        billingMonth: z.number().int().min(1).max(12).optional().describe('Billing month. 7 or 8 applies summer residential blocks.'),
        climateEnvironmentWonPerKwh: z.number().min(-100).max(100).optional().describe('Optional climate/environment charge override per kWh.'),
        fuelAdjustmentWonPerKwh: z.number().min(-100).max(100).optional().describe('Optional fuel adjustment charge override per kWh.')
      },
      annotations: {
        title: 'Estimate Residential Electricity Bill',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async (input) =>
      jsonText(
        estimateBill({
          ...input,
          climateEnvironmentWonPerKwh:
            input.climateEnvironmentWonPerKwh ?? optionalEnvNumber('CLIMATE_ENVIRONMENT_WON_PER_KWH'),
          fuelAdjustmentWonPerKwh: input.fuelAdjustmentWonPerKwh ?? optionalEnvNumber('FUEL_ADJUSTMENT_WON_PER_KWH')
        })
      )
  );

  server.registerTool(
    'compare_electricity_usage_scenarios',
    {
      title: 'Compare Electricity Usage Scenarios',
      description:
        'Use when the user wants optimal usage, comparison, or "몇 시간 줄이면 얼마나 아껴?" for appliances. Compares several hours-per-day scenarios and bill increase when current monthly kWh is known.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language usage comparison request.'),
        applianceName: z.string().min(1).max(80).optional().describe('Optional appliance name.'),
        powerW: z.number().positive().max(100000).optional().describe('Optional appliance power in watts.'),
        baseMonthlyKwh: z.number().min(0).max(10000).optional().describe('Optional current monthly kWh for bill increase comparison.'),
        voltageType: voltageSchema.optional().describe('Residential voltage type. Defaults to low_voltage.'),
        billingMonth: z.number().int().min(1).max(12).optional().describe('Billing month.'),
        scenarioHoursPerDay: z.array(z.number().positive().max(24)).max(8).optional().describe('Usage-hour scenarios such as [4,8,12,24].'),
        daysPerMonth: z.number().positive().max(31).optional().describe('Monthly usage days. Defaults to 30 when omitted.')
      },
      annotations: {
        title: 'Compare Electricity Usage Scenarios',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async (input) => jsonText(compareUsageScenarios(input))
  );

  server.registerTool(
    'classify_kepco_civil_service',
    {
      title: 'Classify KEPCO Civil Service',
      description:
        'Use when the user asks about KEPCO/한전 민원, 한전ON, 명의변경, 이사정산, 전기사용신청, 증설, 자동이체, 청구서 변경, 복지할인, 고객번호, 요금납부, 정전, 전기고장, or 위험설비 신고. Returns the likely service type.',
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Korean natural-language KEPCO civil-service request.')
      },
      annotations: {
        title: 'Classify KEPCO Civil Service',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text }) => jsonText(inferCivilServiceType(text))
  );

  server.registerTool(
    'classify_kepco_civil_service_63',
    {
      title: 'Classify KEPCO Civil Service From 63 Items',
      description:
        'Use when the user describes a KEPCO/한전ON civil-service task. Matches the request against the official 한전ON 민원신청 63-item catalog and returns ranked candidates, whether the action is available now, needs user auth/API, or needs partner agreement.',
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Korean natural-language KEPCO civil-service request.'),
        limit: z.number().int().min(1).max(10).optional().describe('Maximum candidate count. Defaults to 5.')
      },
      annotations: {
        title: 'Classify KEPCO Civil Service From 63 Items',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ text, limit }) => jsonText(classifyCivilServiceCatalog(text, limit))
  );

  server.registerTool(
    'list_kepco_civil_service_catalog',
    {
      title: 'List KEPCO Civil Service Catalog',
      description:
        'Returns the official 한전ON 민원신청 63-item catalog captured for this MVP, including category, service type, integration boundary, expected inputs, likely documents, and MCP action.',
      inputSchema: {},
      annotations: {
        title: 'List KEPCO Civil Service Catalog',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async () => jsonText(listKepcoCivilServiceCatalog())
  );

  server.registerTool(
    'guide_kepco_civil_service',
    {
      title: 'Guide KEPCO Civil Service',
      description:
        'Use for KEPCO 민원 guidance. It routes the request to 한전ON menus, lists required inputs and likely documents, explains why this MCP cannot auto-submit authenticated requests, and prepares a concise draft request text.',
      inputSchema: {
        text: z.string().min(2).max(2000).describe('User request, e.g. "이사정산 하고 싶어", "명의변경 신청서 써줘", "자동이체 바꾸고 싶어".'),
        serviceType: civilServiceSchema.optional().describe('Optional known service type.'),
        customerNumber: z.string().min(2).max(80).optional().describe('Optional KEPCO customer number. Avoid entering private data in public demos.'),
        address: z.string().min(2).max(200).optional().describe('Optional usage-place address. Avoid entering private data in public demos.'),
        applicantName: z.string().min(1).max(80).optional().describe('Optional applicant name.'),
        phone: z.string().min(5).max(40).optional().describe('Optional phone number.'),
        preferredDate: z.string().min(2).max(80).optional().describe('Optional desired processing date or move date.'),
        details: z.string().min(2).max(2000).optional().describe('Optional extra details.')
      },
      annotations: {
        title: 'Guide KEPCO Civil Service',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(guideCivilService({ ...input, serviceType: input.serviceType as CivilServiceType | undefined }))
  );

  server.registerTool(
    'prepare_kepco_application_draft',
    {
      title: 'Prepare KEPCO Application Draft',
      description:
        'Use when the user wants the MCP to fill out or draft a KEPCO civil-service request before submitting in 한전ON. It creates structured fields, missing-input checklist, confirmation checklist, and a Korean handoff text. It never performs real submission.',
      inputSchema: {
        text: z.string().min(2).max(2000).describe('Civil-service request text.'),
        serviceType: civilServiceSchema.optional().describe('Optional known service type.'),
        customerNumber: z.string().min(2).max(80).optional().describe('Optional customer number.'),
        address: z.string().min(2).max(200).optional().describe('Optional usage-place address.'),
        applicantName: z.string().min(1).max(80).optional().describe('Optional applicant name.'),
        phone: z.string().min(5).max(40).optional().describe('Optional phone number.'),
        preferredDate: z.string().min(2).max(80).optional().describe('Optional desired processing date.'),
        details: z.string().min(2).max(2000).optional().describe('Optional extra details.')
      },
      annotations: {
        title: 'Prepare KEPCO Application Draft',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(prepareApplicationDraft({ ...input, serviceType: input.serviceType as CivilServiceType | undefined }))
  );

  server.registerTool(
    'get_kepco_mcp_integration_status',
    {
      title: 'Get KEPCO MCP Integration Status',
      description:
        'Use when the user asks what this MVP can do now, what needs KEPCO/auth/partner integration, or how this differs from ordinary GPT chat. Returns available functions, blocked authenticated actions, and suggested MVP flow.',
      inputSchema: {},
      annotations: {
        title: 'Get KEPCO MCP Integration Status',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async () => jsonText(getKepcoIntegrationStatus())
  );

  server.registerTool(
    'plan_ev_charging_visit',
    {
      title: 'Plan EV Charging Visit',
      description:
        'Use for EV charging route/visit planning such as "30분 뒤 덕평휴게소 근처에서 40kWh 충전하고 싶어". Builds plan A/B using current charger candidates, arrival time, connector/output needs, and clearly separates MVP visit planning from real reservation confirmation.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language EV charging request.'),
        origin: z.string().min(1).max(120).optional().describe('Optional origin.'),
        destination: z.string().min(1).max(120).optional().describe('Optional destination.'),
        routeName: z.string().min(1).max(80).optional().describe('Highway or route name, e.g. 영동고속도로.'),
        direction: z.string().min(1).max(80).optional().describe('Direction, e.g. 강릉방향.'),
        arrivalInMinutes: z.number().min(0).max(1440).optional().describe('Estimated arrival time in minutes.'),
        desiredKwh: z.number().positive().max(300).optional().describe('Desired charge amount in kWh.'),
        connectorType: z.string().min(1).max(80).optional().describe('Connector type such as DC콤보.'),
        minimumOutputKw: z.number().positive().max(1000).optional().describe('Minimum desired charger output.'),
        candidates: z.array(chargerCandidateSchema).max(20).optional().describe('Optional charger status candidates from public API or user-provided data.')
      },
      annotations: {
        title: 'Plan EV Charging Visit',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(planEvChargingVisit(input))
  );

  server.registerTool(
    'get_official_data_sources',
    {
      title: 'Get Official Data Sources',
      description:
        'Returns official source inventory used by this MVP: KEPCO ON tariff/calculator/civil-service pages, public data files, EV charger public API, highway rest-area charger data, and OCPP standard boundary.',
      inputSchema: {},
      annotations: {
        title: 'Get Official Data Sources',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async () => jsonText(OFFICIAL_DATA_SOURCES)
  );

  return server;
}

const app = createMcpExpressApp({ host: '0.0.0.0' });

app.get('/', (_req: Request, res: Response) => {
  res.type('text/plain').send(`${SERVICE_NAME} (${SERVICE_NAME_KO}) is running. Use POST /mcp for MCP requests.`);
});

app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: SERVICE_VERSION });
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
