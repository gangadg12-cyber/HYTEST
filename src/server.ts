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
import { planEvChargingVisitWithLiveData } from './evCharging.js';
import { compareHomeElectricityUsage } from './homeUsage.js';
import { getOfficialDataSourcesResult, SERVICE_NAME, SERVICE_NAME_KO, SERVICE_VERSION, type CivilServiceType } from './kepcoData.js';
import { getApiReadiness, getPublicApis } from './publicApis.js';
import { handleElectricLifeRequest } from './requestRouter.js';
import { analyzeRenewableEnergySale } from './renewableSale.js';
import { checkSolarRegion } from './solar.js';
import { adviseWeatherPowerUsage } from './weatherPower.js';

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
const seasonSchema = z.enum(['summer', 'other']);
const publicApiAreaSchema = z.enum(['bill', 'home_usage', 'civil_service', 'ev_charging', 'location', 'weather', 'solar', 'power_grid']);
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

function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVICE_NAME,
      version: SERVICE_VERSION
    },
    {
      instructions:
        'Use KEPCO Electric Agent tools as an API-first Korean electricity life assistant. For broad, ambiguous, or multi-part Korean requests about electricity bills, KEPCO civil services, EV charging, solar, renewable sale, weather/power risk, or public API readiness, prefer handle_electric_life_request first so the server can split and orchestrate intents. For single-purpose questions, the specialized tools may be called directly. If a public API is unavailable, return the tool result as unavailable instead of inventing arbitrary data. Do not claim to submit KEPCO civil-service requests, payment, auto-transfer, or confirmed EV charger reservations unless an authenticated partner integration is added.'
    }
  );

  server.registerTool(
    'handle_electric_life_request',
    {
      title: 'Handle Electric Life Request',
      description:
        'Preferred entry point for broad, ambiguous, or multi-part Korean electricity-life requests. Use when the user mixes questions such as bill calculation, usage comparison, KEPCO civil service/FAQ/form draft, EV charging station visit planning, solar/renewable sale, REC/SMP, weather-based power advice, or home usage comparison in one message. The server splits intents, runs internal domain logic, returns one combined structured result, and lists clarifying questions when needed.',
      inputSchema: {
        text: z.string().min(2).max(3000).describe('Original Korean natural-language user request. Can contain multiple questions.'),
        locationText: z.string().min(1).max(200).optional().describe('Optional common location text used for EV, weather, solar, or renewable sale routing.'),
        latitude: z.number().min(33).max(39).optional().describe('Optional latitude in Korea.'),
        longitude: z.number().min(124).max(132).optional().describe('Optional longitude in Korea.'),
        radiusKm: z.number().positive().max(100).optional().describe('Optional EV charger search radius in km.'),
        origin: z.string().min(1).max(120).optional().describe('Optional EV route origin.'),
        destination: z.string().min(1).max(120).optional().describe('Optional EV route destination.'),
        routeName: z.string().min(1).max(80).optional().describe('Optional highway/route name.'),
        direction: z.string().min(1).max(80).optional().describe('Optional highway direction.'),
        arrivalInMinutes: z.number().min(0).max(1440).optional().describe('Optional estimated arrival time in minutes.'),
        desiredKwh: z.number().positive().max(300).optional().describe('Optional desired EV charging amount in kWh.'),
        connectorType: z.string().min(1).max(80).optional().describe('Optional exact EV connector type such as DC콤보, CHAdeMO, or AC3상.'),
        minimumOutputKw: z.number().positive().max(1000).optional().describe('Optional minimum charger output.'),
        candidates: z.array(chargerCandidateSchema).max(20).optional().describe('Optional EV charging candidates.'),
        applianceName: z.string().min(1).max(80).optional().describe('Optional appliance/product name.'),
        powerW: z.number().positive().max(100000).optional().describe('Optional appliance power in watts.'),
        hoursPerDay: z.number().positive().max(24).optional().describe('Optional daily appliance usage hours.'),
        daysPerMonth: z.number().positive().max(31).optional().describe('Optional monthly appliance usage days.'),
        baseMonthlyKwh: z.number().min(0).max(10000).optional().describe('Optional current/base monthly electricity usage in kWh.'),
        monthlyKwh: z.number().min(0).max(10000).optional().describe('Optional monthly electricity usage in kWh.'),
        benchmarkMonthlyKwh: z.number().min(0).max(10000).optional().describe('Optional benchmark average monthly kWh for home usage comparison.'),
        householdSize: z.number().int().min(1).max(20).optional().describe('Optional household size.'),
        region: z.string().min(1).max(100).optional().describe('Optional region text.'),
        month: z.number().int().min(1).max(12).optional().describe('Optional month.'),
        billingMonth: z.number().int().min(1).max(12).optional().describe('Optional billing month.'),
        season: seasonSchema.optional().describe('Optional tariff season.'),
        voltageType: voltageSchema.optional().describe('Optional residential voltage type.'),
        customerNumber: z.string().min(2).max(80).optional().describe('Optional KEPCO customer number. Avoid private data in public tests.'),
        address: z.string().min(2).max(200).optional().describe('Optional address. Avoid private data in public tests.'),
        applicantName: z.string().min(1).max(80).optional().describe('Optional applicant name.'),
        phone: z.string().min(5).max(40).optional().describe('Optional phone number.'),
        preferredDate: z.string().min(2).max(80).optional().describe('Optional preferred date.'),
        details: z.string().min(2).max(2000).optional().describe('Optional additional details.'),
        solarCapacityKw: z.number().positive().max(100000).optional().describe('Optional solar capacity in kW.'),
        averageDailyGenerationKwhPerKw: z.number().positive().max(10).optional().describe('Optional average daily solar generation per kW.'),
        averageDailySunHours: z.number().positive().max(15).optional().describe('Optional average daily sun hours.'),
        expectedAnnualGenerationKwh: z.number().positive().max(1000000000).optional().describe('Optional expected annual renewable generation in kWh.'),
        recWeight: z.number().positive().max(10).optional().describe('Optional REC weight.'),
        smpWonPerKwh: z.number().positive().max(10000).optional().describe('Optional SMP in KRW/kWh.'),
        recPriceWonPerRec: z.number().positive().max(1000000).optional().describe('Optional REC price in KRW/REC.'),
        useLiveApi: z.boolean().optional().describe('Set false to skip live public API calls where supported.')
      },
      annotations: {
        title: 'Handle Electric Life Request',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(await handleElectricLifeRequest(input))
  );

  server.registerTool(
    'parse_electricity_usage_request',
    {
      title: 'Parse Electricity Usage Request',
      description:
        'Use when the user asks in Korean about an appliance, electricity usage, kWh, W/kW, monthly usage, 에어컨/건조기/전자레인지/공기청정기/전기장판/전기차/히터 usage, bill amount, or bill increase. Use this even when the user says they do not know the wattage. Extracts appliance name, default/preset power W when available, minutes/hours per day, days or uses per month, current monthly kWh, voltage type, and missing fields before calculation.',
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
        'Always use for Korean electricity-bill or appliance questions like "우리집 이번 달 350kWh 썼으면 얼마야?", "350kWh면 요금 얼마야?", "7월에 500kWh 나오면?", "250kWh랑 350kWh 차이", "건조기 1회 2kWh 한 달 20번", "900W 전자레인지 매일 10분", "공기청정기 24시간 켜두면", "전기장판 밤마다 틀면", "에어컨 1800W 하루 8시간 틀면 전기요금 얼마 늘어?", or "전기차 충전하면 요금?". The tool has appliance presets and returns missing fields, so call it even when wattage, hours, or days are incomplete. Calculates current residential bill when only monthly kWh is given, or additional kWh and bill increase when appliance usage is given. This is an estimate, not an official bill.',
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
    async (input) => jsonText(estimateBill(input))
  );

  server.registerTool(
    'compare_electricity_usage_scenarios',
    {
      title: 'Compare Electricity Usage Scenarios',
      description:
        'Use when the user wants optimal usage, scenario comparison, bill comparison, "몇 시간 줄이면 얼마나 아껴?", "250kWh랑 350kWh 차이", "작년보다 80kWh 더 썼는데 얼마나 늘어?", or appliance usage scenarios. Compares several hours-per-day/day-count scenarios and can compare multiple monthly kWh bill totals.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language usage comparison request.'),
        applianceName: z.string().min(1).max(80).optional().describe('Optional appliance name.'),
        powerW: z.number().positive().max(100000).optional().describe('Optional appliance power in watts.'),
        baseMonthlyKwh: z.number().min(0).max(10000).optional().describe('Optional current monthly kWh for bill increase comparison.'),
        voltageType: voltageSchema.optional().describe('Residential voltage type. Defaults to low_voltage.'),
        billingMonth: z.number().int().min(1).max(12).optional().describe('Billing month.'),
        scenarioHoursPerDay: z.array(z.number().positive().max(24)).max(8).optional().describe('Usage-hour scenarios such as [4,8,12,24].'),
        scenarioDaysPerMonth: z
          .array(z.number().positive().max(31))
          .max(8)
          .optional()
          .describe('Usage-day scenarios such as [10,20,30]. If used, hours per day must be known from text or scenarioHoursPerDay.'),
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
    'get_public_api_catalog',
    {
      title: 'Get Public API Catalog',
      description:
        'Use when the user asks which official/public APIs back this MCP, which features are API-backed, what API keys are needed, or what is currently unavailable. Returns KEPCO/KMA/KPX/EV/solar API catalog and readiness.',
      inputSchema: {
        area: publicApiAreaSchema.optional().describe('Optional area filter such as bill, home_usage, weather, solar, ev_charging, power_grid.'),
        feature: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe('Optional feature filter such as electric_bill, compare_home_usage, weather_power_advisor, solar_region_checker, ev_charging.'),
        includeReadiness: z.boolean().optional().describe('Whether to include API credential/readiness status. Defaults to true.')
      },
      annotations: {
        title: 'Get Public API Catalog',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async ({ area, feature, includeReadiness }) =>
      jsonText({
        apis: getPublicApis({ area, feature }),
        readiness: includeReadiness === false ? undefined : getApiReadiness({ area, feature }),
        policy:
          'This MCP is API-first. If a required public API credential or endpoint is missing, the related tool returns unavailable instead of arbitrary data.'
      })
  );

  server.registerTool(
    'compare_home_electricity_usage',
    {
      title: 'Compare Home Electricity Usage',
      description:
        'Use when the user asks whether their home electricity usage is higher than average, e.g. "우리집 420kWh면 평균보다 많아?". This is API-first: without a public average usage API or user-provided benchmarkMonthlyKwh, it returns unavailable instead of inventing an average.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language home usage comparison question.'),
        monthlyKwh: z.number().min(0).max(10000).optional().describe('User home monthly usage in kWh.'),
        householdSize: z.number().int().min(1).max(20).optional().describe('Optional household size.'),
        region: z.string().min(1).max(80).optional().describe('Optional region such as 서울 강남구.'),
        month: z.number().int().min(1).max(12).optional().describe('Billing/comparison month.'),
        season: seasonSchema.optional().describe('Optional season override.'),
        voltageType: voltageSchema.optional().describe('Residential voltage type. Defaults to low_voltage.'),
        benchmarkMonthlyKwh: z.number().min(0).max(10000).optional().describe('Optional public average benchmark. If omitted and API is not configured, no comparison is fabricated.'),
        benchmarkLabel: z.string().min(1).max(120).optional().describe('Optional benchmark label.')
      },
      annotations: {
        title: 'Compare Home Electricity Usage',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(compareHomeElectricityUsage(input))
  );

  server.registerTool(
    'advise_weather_power_usage',
    {
      title: 'Advise Weather Power Usage',
      description:
        'Use for weather-based electricity advice such as 폭염 냉방비, 한파 전기난방, 피크 시간대, or weather-related bill risk. Calls KMA public API when KMA_SHORT_FORECAST_SERVICE_KEY/DATA_GO_KR_SERVICE_KEY and nx/ny are available; if locationText is provided, it can resolve coordinates through Kakao Local first. Otherwise requires user-provided weather data.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language weather/power question.'),
        locationText: z.string().min(1).max(160).optional().describe('Optional location text. KMA API still needs nx/ny unless geocoding is added.'),
        nx: z.number().int().min(1).max(200).optional().describe('KMA grid x coordinate.'),
        ny: z.number().int().min(1).max(200).optional().describe('KMA grid y coordinate.'),
        temperatureC: z.number().min(-50).max(60).optional().describe('User-provided current or forecast temperature in Celsius.'),
        alertType: z.enum(['heat_wave', 'cold_wave', 'heavy_rain', 'typhoon', 'none']).optional().describe('Optional weather alert type.'),
        baseMonthlyKwh: z.number().min(0).max(10000).optional().describe('Current monthly electricity usage for bill risk simulation.'),
        applianceName: z.string().min(1).max(80).optional().describe('Optional weather-related appliance such as 에어컨 or 전기히터.'),
        powerW: z.number().positive().max(100000).optional().describe('Optional appliance power in watts.'),
        hoursPerDay: z.number().positive().max(24).optional().describe('Optional expected daily use hours.'),
        daysPerMonth: z.number().positive().max(31).optional().describe('Optional expected monthly use days.'),
        useLiveApi: z.boolean().optional().describe('Set false to skip KMA API lookup.')
      },
      annotations: {
        title: 'Advise Weather Power Usage',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(await adviseWeatherPowerUsage(input))
  );

  server.registerTool(
    'check_solar_region',
    {
      title: 'Check Solar Region',
      description:
        'Use for solar or renewable questions such as "태양광 설치하면 우리 지역 괜찮아?", "3kW 태양광이면 요금 얼마나 줄어?", or "전기차랑 태양광 같이 쓰면 이득이야?". It is API-first and returns unavailable unless public solar API data or user-provided generation/sun-hour assumptions are available.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language solar question.'),
        region: z.string().min(1).max(100).optional().describe('Optional region.'),
        latitude: z.number().min(33).max(39).optional().describe('Optional latitude in Korea.'),
        longitude: z.number().min(124).max(132).optional().describe('Optional longitude in Korea.'),
        solarCapacityKw: z.number().positive().max(1000).optional().describe('Solar PV capacity in kW. Defaults to 3kW.'),
        averageDailyGenerationKwhPerKw: z.number().positive().max(10).optional().describe('User-provided average daily generation per 1kW PV.'),
        averageDailySunHours: z.number().positive().max(15).optional().describe('User-provided average effective sun hours per day.'),
        currentMonthlyKwh: z.number().min(0).max(10000).optional().describe('Current monthly electricity usage for bill-saving simulation.'),
        voltageType: voltageSchema.optional().describe('Residential voltage type. Defaults to low_voltage.'),
        season: seasonSchema.optional().describe('Optional tariff season.')
      },
      annotations: {
        title: 'Check Solar Region',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(checkSolarRegion(input))
  );

  server.registerTool(
    'analyze_renewable_energy_sale',
    {
      title: 'Analyze Renewable Energy Sale',
      description:
        'Use when the user asks about selling electricity from solar/renewable generation, 남는 전기 판매, 태양광 판매, REC, SMP, PPA, 요금상계거래, 발전사업, grid interconnection, 계통연계, 분산전원, renewable contract status, or whether a location is suitable for renewable power sale. Calls KEPCO Bigdata APIs for common codes, renewable contracts, and dispersed generation when KEPCO_BIGDATA_API_KEY is configured. Uses user-provided SMP/REC or configured KPX endpoints without inventing prices.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language renewable sale question.'),
        locationText: z.string().min(1).max(200).optional().describe('Installation/sale location such as address, city, district, or place name.'),
        year: z.number().int().min(2010).max(2100).optional().describe('KEPCO renewable contract status year. Defaults to previous year.'),
        metroCd: z.string().min(2).max(2).optional().describe('KEPCO metro code from commonCode.do codeTy=metroCd.'),
        cityCd: z.string().min(2).max(5).optional().describe('KEPCO city/district code from commonCode.do codeTy=cityCd.'),
        addrLidong: z.string().min(1).max(80).optional().describe('Legal dong/myeon text for dispersedGeneration.do.'),
        addrLi: z.string().min(1).max(80).optional().describe('Ri address for dispersedGeneration.do.'),
        addrJibun: z.string().min(1).max(80).optional().describe('Jibun address detail for dispersedGeneration.do.'),
        substCd: z.string().min(1).max(20).optional().describe('Optional substation code for dispersedGeneration.do.'),
        genSrcCd: z.string().min(1).max(4).optional().describe('Generation source code. Defaults to 1 for solar.'),
        generationSource: z.string().min(1).max(80).optional().describe('Generation source label such as solar, wind, small hydro.'),
        solarCapacityKw: z.number().positive().max(100000).optional().describe('Planned installed capacity in kW.'),
        expectedAnnualGenerationKwh: z.number().positive().max(1000000000).optional().describe('Expected annual generation in kWh.'),
        recWeight: z.number().positive().max(10).optional().describe('REC weight. Defaults to 1.'),
        smpWonPerKwh: z.number().positive().max(10000).optional().describe('User-provided SMP in KRW/kWh.'),
        recPriceWonPerRec: z.number().positive().max(1000000).optional().describe('User-provided REC price in KRW/REC.'),
        useLiveApi: z.boolean().optional().describe('Set false to skip live KEPCO/Kakao/KPX API calls.')
      },
      annotations: {
        title: 'Analyze Renewable Energy Sale',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true
      }
    },
    async (input) => jsonText(await analyzeRenewableEnergySale(input))
  );

  server.registerTool(
    'classify_kepco_civil_service',
    {
      title: 'Classify KEPCO Civil Service',
      description:
        'Use when the user asks about KEPCO/한전 민원, 한전ON, FAQ, 자주 묻는 질문, 명의변경, 이사정산, 전기사용신청, 증설, 계약변경, 자동이체, 청구서 변경, 복지할인, 고객번호, 요금납부, 정전, 전기고장, 위험설비 신고, 서류 작성, or 신청서 초안. Returns the likely service type.',
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
        'Use when the user describes a KEPCO/한전ON civil-service task, FAQ, or application-form request. Matches the request against the official 한전ON 민원신청 63-item catalog and returns ranked candidates, whether the action is available now, needs user auth/API, or needs partner agreement.',
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
        'Returns a compact summary of the official 한전ON 민원신청 63-item catalog captured for this MVP. Defaults to category summaries only; set includeDetails=true for limited detailed items. Search filters match category, 민원명, keywords, summary, service type, and official path, so "증설", "자동이체", "서식" can be used as filters.',
      inputSchema: {
        query: z.string().min(1).max(80).optional().describe('Optional search keyword across category, label, keywords, summary, service type, and official path.'),
        category: z.string().min(1).max(80).optional().describe('Backward-compatible search keyword filter. It also searches label and keywords, not just category.'),
        limit: z.number().int().min(1).max(63).optional().describe('Maximum detailed item count. Defaults to 20.'),
        includeDetails: z.boolean().optional().describe('Whether to include detailed catalog item objects. Defaults to false.')
      },
      annotations: {
        title: 'List KEPCO Civil Service Catalog',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async (input) => jsonText(listKepcoCivilServiceCatalog(input))
  );

  server.registerTool(
    'guide_kepco_civil_service',
    {
      title: 'Guide KEPCO Civil Service',
      description:
        'Use for KEPCO 민원/FAQ/application guidance. It routes the request to 한전ON menus, lists required inputs and likely documents, explains the current authenticated-submission boundary, and prepares a concise draft request text without claiming final submission.',
      inputSchema: {
        text: z.string().min(2).max(2000).describe('User request, e.g. "이사정산 하고 싶어", "명의변경 신청서 써줘", "자동이체 바꾸고 싶어".'),
        serviceType: civilServiceSchema.optional().describe('Optional known service type.'),
        customerNumber: z.string().min(2).max(80).optional().describe('Optional KEPCO customer number. Avoid entering private data in public tests.'),
        address: z.string().min(2).max(200).optional().describe('Optional usage-place address. Avoid entering private data in public tests.'),
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
        'Use when the user wants the MCP to fill out, explain, or draft a KEPCO civil-service form before submitting in 한전ON. It creates structured fields, missing-input checklist, confirmation checklist, field meaning guidance, and a Korean handoff text. It never performs real submission.',
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
        'Use for EV charging route/visit planning such as "서울 강남구 근처 충전소 찾아줘", "위도/경도 주변 DC콤보 찾아줘", "30분 뒤 덕평휴게소 근처에서 40kWh 충전하고 싶어", or "차데모 충전소만 찾아줘". When locationText/zcode/zscode/coordinates are provided and EV_CHARGER_SERVICE_KEY is configured, it calls the public KECO EV charger API for real charger location/status candidates, then builds plan A/B. If the public API fails or returns no matching candidates, report that failure instead of inventing replacement chargers. It clearly separates status-based visit planning from real reservation confirmation.',
      inputSchema: {
        text: z.string().min(2).max(2000).optional().describe('Natural-language EV charging request.'),
        origin: z.string().min(1).max(120).optional().describe('Optional origin.'),
        destination: z.string().min(1).max(120).optional().describe('Optional destination.'),
        locationText: z.string().min(1).max(160).optional().describe('User location or target area such as 서울 강남구, 경기 이천 덕평휴게소, 제주공항. Used to infer zcode and filter API results.'),
        latitude: z.number().min(33).max(39).optional().describe('Optional current or target latitude in Korea. Used for distance filtering when provided with longitude.'),
        longitude: z.number().min(124).max(132).optional().describe('Optional current or target longitude in Korea. Used for distance filtering when provided with latitude.'),
        radiusKm: z.number().positive().max(100).optional().describe('Optional search radius in km when latitude/longitude are provided. Defaults to 15.'),
        zcode: z.string().min(2).max(2).optional().describe('Optional Korean province/city code first two digits, e.g. 11 Seoul, 41 Gyeonggi.'),
        zscode: z.string().min(5).max(5).optional().describe('Optional Korean city/district code, e.g. 11680 for Seoul Gangnam-gu.'),
        useLiveApi: z.boolean().optional().describe('Set false to skip public EV charger API lookup. Without provided candidates, no recommendation is returned. Defaults to true when location is available.'),
        apiNumOfRows: z.number().int().min(10).max(100).optional().describe('Optional public API row count. Defaults to 20 and is capped at 100 to avoid public API timeouts.'),
        routeName: z.string().min(1).max(80).optional().describe('Highway or route name, e.g. 영동고속도로.'),
        direction: z.string().min(1).max(80).optional().describe('Direction, e.g. 강릉방향.'),
        arrivalInMinutes: z.number().min(0).max(1440).optional().describe('Estimated arrival time in minutes.'),
        desiredKwh: z.number().positive().max(300).optional().describe('Desired charge amount in kWh.'),
        connectorType: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe('Exact connector type such as DC콤보, CHAdeMO, or AC3상. Mismatched connectors must not be recommended.'),
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
    async (input) => jsonText(await planEvChargingVisitWithLiveData(input))
  );

  server.registerTool(
    'get_official_data_sources',
    {
      title: 'Get Official Data Sources',
      description:
        'Returns official source inventory used by this MVP with Markdown URLs: KEPCO ON tariff/calculator/civil-service/form pages, public data files, EV charger public API, and highway rest-area charger data.',
      inputSchema: {},
      annotations: {
        title: 'Get Official Data Sources',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true
      }
    },
    async () => jsonText(getOfficialDataSourcesResult())
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
