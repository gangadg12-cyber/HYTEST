import { APPLIANCE_PRESETS, getResidentialTariff, type Season, type VoltageType } from './kepcoData.js';

export interface BillEstimateInput {
  text?: string;
  applianceName?: string;
  powerW?: number;
  hoursPerDay?: number;
  daysPerMonth?: number;
  baseMonthlyKwh?: number;
  voltageType?: VoltageType;
  billingMonth?: number;
  climateEnvironmentWonPerKwh?: number;
  fuelAdjustmentWonPerKwh?: number;
}

export interface ParsedUsageRequest {
  applianceName?: string;
  powerW?: number;
  hoursPerDay?: number;
  daysPerMonth?: number;
  baseMonthlyKwh?: number;
  perUseKwh?: number;
  usesPerMonth?: number;
  additionalMonthlyKwhDirect?: number;
  voltageType: VoltageType;
  billingMonth?: number;
  season: Season;
  assumptions: string[];
  missingFields: string[];
}

export interface BillBreakdown {
  monthlyKwh: number;
  basicChargeWon: number;
  energyChargeWon: number;
  climateEnvironmentChargeWon: number;
  fuelAdjustmentChargeWon: number;
  electricityChargeBeforeTaxWon: number;
  vatWon: number;
  powerIndustryFundWon: number;
  estimatedTotalWon: number;
  blockDetails: Array<{
    fromExclusiveKwh: number;
    toInclusiveKwh?: number;
    appliedKwh: number;
    rateWonPerKwh: number;
    chargeWon: number;
  }>;
}

export interface BillEstimateResult {
  parsed: ParsedUsageRequest;
  currentBill?: BillBreakdown;
  currentBillSummary?: string;
  additionalMonthlyKwh?: number;
  beforeBill?: BillBreakdown;
  afterBill?: BillBreakdown;
  increaseWon?: number;
  increasePercent?: number;
  marginalScenarios?: Array<{
    assumedBaseMonthlyKwh: number;
    afterMonthlyKwh: number;
    estimatedIncreaseWon: number;
  }>;
  usageFormula?: string;
  recommendations: string[];
  tariffBasis: {
    basisDate: string;
    sourceLabel: string;
    sourceUrl: string;
    notes: string[];
  };
  disclaimer: string;
}

function roundWon(value: number): number {
  return Math.round(value);
}

function floorToTen(value: number): number {
  return Math.floor(value / 10) * 10;
}

function compact(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function getCurrentKoreanMonth(): number {
  const now = new Date();
  return now.getMonth() + 1;
}

function inferSeason(month: number): Season {
  return month === 7 || month === 8 ? 'summer' : 'other';
}

function numberFromMatch(match: RegExpMatchArray | null): number | undefined {
  if (!match?.[1]) {
    return undefined;
  }
  const value = Number.parseFloat(match[1].replace(',', ''));
  return Number.isFinite(value) ? value : undefined;
}

function parseNumberNear(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const value = numberFromMatch(text.match(pattern));
    if (typeof value === 'number') {
      return value;
    }
  }
  return undefined;
}

function parseScenarioDays(text?: string): number[] | undefined {
  if (!text) {
    return undefined;
  }
  const matches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*일/g))
    .map((match) => Number.parseFloat(match[1] ?? ''))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 31);
  const unique = Array.from(new Set(matches));
  return unique.length > 1 ? unique : undefined;
}

function extractKwhValues(text: string): number[] {
  return Array.from(text.matchAll(/(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/gi))
    .map((match) => Number.parseFloat(match[1] ?? ''))
    .filter((value) => Number.isFinite(value));
}

function inferAppliance(text: string): { applianceName?: string; powerW?: number; note?: string } {
  const lower = text.toLowerCase();
  for (const preset of APPLIANCE_PRESETS) {
    if (preset.aliases.some((alias) => lower.includes(alias.toLowerCase()))) {
      return {
        applianceName: preset.applianceName,
        powerW: preset.typicalPowerW,
        note: `${preset.applianceName} 소비전력은 ${preset.typicalPowerW}W 기본값을 사용했습니다. ${preset.note}`
      };
    }
  }
  return {};
}

function parsePowerW(text: string): number | undefined {
  const kw = parseNumberNear(text, [
    /(\d+(?:\.\d+)?)\s*(?:kw|킬로와트)(?!\s*(?:h|시))/i,
    /(\d+(?:\.\d+)?)\s*킬로와트(?!시)/i
  ]);
  if (typeof kw === 'number') {
    return kw * 1000;
  }
  return parseNumberNear(text, [
    /(\d+(?:\.\d+)?)\s*w\b/i,
    /(\d+(?:\.\d+)?)\s*와트/i
  ]);
}

function parseHoursPerDay(text: string, applianceName?: string): { value?: number; assumption?: string } {
  const hour = parseNumberNear(text, [
    /하루\s*(\d+(?:\.\d+)?)\s*시간/,
    /매일\s*(\d+(?:\.\d+)?)\s*시간/,
    /1일\s*(\d+(?:\.\d+)?)\s*시간/,
    /(\d+(?:\.\d+)?)\s*시간\s*\/?\s*(?:일|하루)?/,
    /(\d+(?:\.\d+)?)\s*시간씩/
  ]);
  if (typeof hour === 'number') {
    return { value: Math.min(hour, 24) };
  }

  const minutes = parseNumberNear(text, [
    /하루\s*(\d+(?:\.\d+)?)\s*분/,
    /매일\s*(\d+(?:\.\d+)?)\s*분/,
    /(\d+(?:\.\d+)?)\s*분씩/,
    /(\d+(?:\.\d+)?)\s*분/
  ]);
  if (typeof minutes === 'number') {
    return {
      value: Math.min(minutes / 60, 24),
      assumption: `${minutes}분 사용을 ${Number((minutes / 60).toFixed(3))}시간으로 환산했습니다.`
    };
  }

  if (/(하루\s*종일|종일|24\s*시간|계속|항상|켜두|켜\s*두)/.test(text)) {
    return { value: 24, assumption: '"하루 종일/24시간" 표현을 24시간/일로 해석했습니다.' };
  }

  if (/(밤마다|밤새|취침|자는\s*동안)/.test(text) && applianceName?.includes('전기장판')) {
    return { value: 8, assumption: '전기장판의 "밤마다/취침" 사용은 8시간/일로 가정했습니다.' };
  }

  return {};
}

function parseDaysPerMonth(text: string): { value?: number; assumption?: string } {
  const days = parseNumberNear(text, [
    /(\d+(?:\.\d+)?)\s*일\s*(?:동안|간)?/,
    /월\s*(\d+(?:\.\d+)?)\s*일/,
    /한\s*달\s*(\d+(?:\.\d+)?)\s*일/
  ]);
  if (typeof days === 'number') {
    return { value: Math.min(days, 31) };
  }

  if (/(매일|한\s*달|한달|이번\s*달|이번달|월간|하루\s*종일|종일|24\s*시간|계속|항상|밤마다|밤새)/.test(text)) {
    return { value: 30, assumption: '월 사용일수는 매일 사용 기준 30일로 계산했습니다.' };
  }

  return {};
}

function parsePerUseKwh(text: string): number | undefined {
  return parseNumberNear(text, [
    /(?:1\s*회|회당|한\s*번|1\s*번)\s*(?:당)?\s*(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/i,
    /(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)\s*(?:\/\s*회|\/\s*번|씩|1\s*회|회당|한\s*번)/i
  ]);
}

function parseUsesPerMonth(text: string): number | undefined {
  return parseNumberNear(text, [
    /한\s*달\s*(\d+(?:\.\d+)?)\s*(?:번|회)/,
    /한달\s*(\d+(?:\.\d+)?)\s*(?:번|회)/,
    /월\s*(\d+(?:\.\d+)?)\s*(?:번|회)/,
    /(\d+(?:\.\d+)?)\s*(?:번|회)\s*(?:사용|돌|쓰)/
  ]);
}

function parseDirectAdditionalKwh(text: string): number | undefined {
  const reduced = parseNumberNear(text, [
    /(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)\s*(?:줄|감소|절감|덜|빼|낮)/i,
    /(?:줄|줄이|줄였|줄면|줄어|감소|절감|덜|빼|낮)\s*(?:였|이면|이면은|하면|한다면|된다면|되면|사용|썼|쓰면)?\s*(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/i
  ]);
  if (typeof reduced === 'number') {
    return -reduced;
  }
  return parseNumberNear(text, [
    /(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)\s*(?:더|추가|늘|증가|많)/i,
    /(?:더|추가|늘|증가|많)\s*(?:썼|사용|나왔|된다면|되면)?\s*(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/i
  ]);
}

function parseMonthlyKwh(text: string, hasUsageDetail: boolean): number | undefined {
  const monthly = parseNumberNear(text, [
    /(?:기존|현재|평소|지난달|전월).{0,18}?(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/i,
    /(?:월|월간|한\s*달|한달|이번\s*달|이번달|이번\s*월|이번월).{0,18}?(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/i,
    /(?:사용량|전력량|전기).{0,18}?(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/i,
    /(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시).{0,18}?(?:기준|에서|인데|쓰는데|사용중|사용\s*중|쓰고|나오는데)/i,
    /(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|킬로와트시|키로와트시).{0,18}?(?:썼|사용|나왔|정도|청구|요금|쓸)/i
  ]);
  if (typeof monthly === 'number') {
    return monthly;
  }

  const values = extractKwhValues(text);
  if (values.length === 1 && !hasUsageDetail) {
    return values[0];
  }
  return undefined;
}

export function parseUsageRequest(input: BillEstimateInput): ParsedUsageRequest {
  const text = input.text?.trim() ?? '';
  const normalized = text.replace(/,/g, '');
  const assumptions: string[] = [];

  const inferredAppliance = input.applianceName ? { applianceName: input.applianceName } : inferAppliance(normalized);
  let applianceName = input.applianceName ?? inferredAppliance.applianceName;

  let powerW = input.powerW;
  if (typeof powerW !== 'number') {
    powerW = parsePowerW(normalized);
  }
  if (typeof powerW !== 'number' && typeof inferredAppliance.powerW === 'number') {
    powerW = inferredAppliance.powerW;
    if (inferredAppliance.note) {
      assumptions.push(inferredAppliance.note);
    }
  }

  if (!applianceName && text) {
    const candidate = normalized.match(/([가-힣A-Za-z0-9+\- ]{2,24})(?:를|을)?\s*(?:하루|매일|종일|사용|켜|돌|쓰)/);
    applianceName = candidate?.[1]?.trim();
  }

  let hoursPerDay = input.hoursPerDay;
  if (typeof hoursPerDay !== 'number') {
    const parsedHours = parseHoursPerDay(normalized, applianceName);
    hoursPerDay = parsedHours.value;
    if (parsedHours.assumption) {
      assumptions.push(parsedHours.assumption);
    }
  }

  let daysPerMonth = input.daysPerMonth;
  if (typeof daysPerMonth !== 'number') {
    const parsedDays = parseDaysPerMonth(normalized);
    daysPerMonth = parsedDays.value;
    if (parsedDays.assumption) {
      assumptions.push(parsedDays.assumption);
    }
  }

  const perUseKwh = parsePerUseKwh(normalized);
  const usesPerMonth = parseUsesPerMonth(normalized);
  const additionalMonthlyKwhDirect = parseDirectAdditionalKwh(normalized);

  let baseMonthlyKwh = input.baseMonthlyKwh;
  if (typeof baseMonthlyKwh !== 'number') {
    baseMonthlyKwh = parseMonthlyKwh(
      normalized,
      typeof powerW === 'number' || typeof hoursPerDay === 'number' || typeof daysPerMonth === 'number'
    );
  }

  let billingMonth = input.billingMonth;
  if (typeof billingMonth !== 'number') {
    billingMonth = parseNumberNear(normalized, [/(\d{1,2})\s*월/]);
  }
  if (typeof billingMonth !== 'number' && /(여름|하계|에어컨|냉방)/.test(normalized)) {
    billingMonth = 7;
    assumptions.push('여름/에어컨 표현이 있어 7월 하계 구간으로 계산했습니다.');
  }
  if (typeof billingMonth !== 'number') {
    billingMonth = getCurrentKoreanMonth();
    assumptions.push(`청구월 입력이 없어 현재 월 ${billingMonth}월 기준으로 계산했습니다.`);
  }

  const voltageType = input.voltageType ?? (/고압/.test(normalized) ? 'high_voltage' : 'low_voltage');
  if (!input.voltageType && voltageType === 'low_voltage') {
    assumptions.push('전압 구분 입력이 없어 주택용 저압 기준으로 계산했습니다.');
  }

  const hasDirectAdditional = typeof additionalMonthlyKwhDirect === 'number';
  const hasPerUseCalculation = typeof perUseKwh === 'number' && typeof usesPerMonth === 'number';
  const hasPowerCalculation = typeof powerW === 'number' && typeof hoursPerDay === 'number' && typeof daysPerMonth === 'number';
  const isCurrentBillOnlyQuery =
    typeof baseMonthlyKwh === 'number' && !hasDirectAdditional && !hasPerUseCalculation && !hasPowerCalculation && !applianceName;

  const missingFields: string[] = [];
  if (!isCurrentBillOnlyQuery && !hasDirectAdditional && !hasPerUseCalculation && !hasPowerCalculation) {
    if (typeof perUseKwh === 'number' && typeof usesPerMonth !== 'number') {
      missingFields.push('월 사용 횟수');
    } else {
      if (typeof powerW !== 'number') {
        missingFields.push('제품 소비전력(W 또는 kW)');
      }
      if (typeof hoursPerDay !== 'number') {
        missingFields.push('하루 사용시간');
      }
      if (typeof daysPerMonth !== 'number') {
        missingFields.push('월 사용일수');
      }
    }
  }

  return {
    applianceName,
    powerW,
    hoursPerDay,
    daysPerMonth,
    baseMonthlyKwh,
    perUseKwh,
    usesPerMonth,
    additionalMonthlyKwhDirect,
    voltageType,
    billingMonth,
    season: inferSeason(billingMonth),
    assumptions,
    missingFields
  };
}

function calculateEnergyCharge(monthlyKwh: number, voltageType: VoltageType, season: Season): Pick<BillBreakdown, 'basicChargeWon' | 'energyChargeWon' | 'blockDetails'> {
  const tariff = getResidentialTariff(voltageType, season);
  const selectedBlock = tariff.blocks.find((block) => typeof block.upToKwh !== 'number' || monthlyKwh <= block.upToKwh) ?? tariff.blocks[tariff.blocks.length - 1];
  let remaining = Math.max(0, monthlyKwh);
  let previousLimit = 0;
  const blockDetails: BillBreakdown['blockDetails'] = [];
  let energyChargeWon = 0;

  for (const block of tariff.blocks) {
    const limit = block.upToKwh ?? Number.POSITIVE_INFINITY;
    const span = limit - previousLimit;
    const appliedKwh = Math.min(remaining, span);
    if (appliedKwh > 0) {
      const chargeWon = appliedKwh * block.rateWonPerKwh;
      energyChargeWon += chargeWon;
      blockDetails.push({
        fromExclusiveKwh: previousLimit,
        toInclusiveKwh: Number.isFinite(limit) ? limit : undefined,
        appliedKwh: Number(appliedKwh.toFixed(3)),
        rateWonPerKwh: block.rateWonPerKwh,
        chargeWon: roundWon(chargeWon)
      });
      remaining -= appliedKwh;
    }
    previousLimit = limit;
    if (remaining <= 0) {
      break;
    }
  }

  return {
    basicChargeWon: selectedBlock.basicWon,
    energyChargeWon: roundWon(energyChargeWon),
    blockDetails
  };
}

export function calculateResidentialBill(input: {
  monthlyKwh: number;
  voltageType: VoltageType;
  season: Season;
  climateEnvironmentWonPerKwh?: number;
  fuelAdjustmentWonPerKwh?: number;
}): BillBreakdown {
  const tariff = getResidentialTariff(input.voltageType, input.season);
  const monthlyKwh = Math.max(0, input.monthlyKwh);
  const charge = calculateEnergyCharge(monthlyKwh, input.voltageType, input.season);
  const climateUnit = input.climateEnvironmentWonPerKwh ?? tariff.climateEnvironmentWonPerKwh;
  const fuelUnit = input.fuelAdjustmentWonPerKwh ?? tariff.fuelAdjustmentWonPerKwh;
  const climateEnvironmentChargeWon = roundWon(monthlyKwh * climateUnit);
  const fuelAdjustmentChargeWon = roundWon(monthlyKwh * fuelUnit);
  const electricityChargeBeforeTaxWon =
    charge.basicChargeWon + charge.energyChargeWon + climateEnvironmentChargeWon + fuelAdjustmentChargeWon;
  const vatWon = roundWon(electricityChargeBeforeTaxWon * tariff.vatRate);
  const powerIndustryFundWon = floorToTen(electricityChargeBeforeTaxWon * tariff.powerIndustryFundRate);

  return {
    monthlyKwh: Number(monthlyKwh.toFixed(3)),
    basicChargeWon: charge.basicChargeWon,
    energyChargeWon: charge.energyChargeWon,
    climateEnvironmentChargeWon,
    fuelAdjustmentChargeWon,
    electricityChargeBeforeTaxWon,
    vatWon,
    powerIndustryFundWon,
    estimatedTotalWon: floorToTen(electricityChargeBeforeTaxWon + vatWon + powerIndustryFundWon),
    blockDetails: charge.blockDetails
  };
}

function buildRecommendations(parsed: ParsedUsageRequest, additionalKwh?: number): string[] {
  const tips: string[] = [];
  if (parsed.applianceName?.includes('에어컨')) {
    tips.push('에어컨은 설정온도 1~2도 상향, 선풍기 병행, 필터 청소, 외출 전 연속/예약 운전 비교가 요금 절감에 효과적입니다.');
  }
  if (typeof parsed.baseMonthlyKwh === 'number' && typeof additionalKwh === 'number') {
    const after = parsed.baseMonthlyKwh + additionalKwh;
    if (parsed.season === 'summer' && parsed.baseMonthlyKwh <= 450 && after > 450) {
      tips.push('하계 450kWh 초과 구간으로 넘어가면 추가 사용분 체감요금이 커지므로 사용시간을 줄이는 효과가 큽니다.');
    } else if (parsed.season === 'other' && parsed.baseMonthlyKwh <= 400 && after > 400) {
      tips.push('400kWh 초과 구간으로 넘어가면 누진 3단계가 적용되어 추가 사용분 체감요금이 커집니다.');
    }
  }
  tips.push('제품 소비전력, 실제 사용시간, 현재 월 사용량을 넣으면 추정 정확도가 올라갑니다.');
  return tips;
}

function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function summarizeBill(prefix: string, bill: BillBreakdown): string {
  return [
    `${prefix} 예상 전기요금은 ${formatWon(bill.estimatedTotalWon)}입니다.`,
    `기본요금 ${formatWon(bill.basicChargeWon)}, 전력량요금 ${formatWon(bill.energyChargeWon)}, 기후환경요금 ${formatWon(
      bill.climateEnvironmentChargeWon
    )}, 연료비조정요금 ${formatWon(bill.fuelAdjustmentChargeWon)}, 부가가치세 ${formatWon(bill.vatWon)}, 전력산업기반기금 ${formatWon(
      bill.powerIndustryFundWon
    )} 기준입니다.`
  ].join(' ');
}

function deriveAdditionalKwh(parsed: ParsedUsageRequest): { additionalMonthlyKwh?: number; usageFormula?: string } {
  if (typeof parsed.additionalMonthlyKwhDirect === 'number') {
    return {
      additionalMonthlyKwh: Number(parsed.additionalMonthlyKwhDirect.toFixed(3)),
      usageFormula: `직접 입력된 추가 사용량 = ${parsed.additionalMonthlyKwhDirect}kWh`
    };
  }

  if (typeof parsed.perUseKwh === 'number' && typeof parsed.usesPerMonth === 'number') {
    const additionalMonthlyKwh = Number((parsed.perUseKwh * parsed.usesPerMonth).toFixed(3));
    return {
      additionalMonthlyKwh,
      usageFormula: `${parsed.perUseKwh}kWh/회 * ${parsed.usesPerMonth}회 = ${additionalMonthlyKwh}kWh`
    };
  }

  if (typeof parsed.powerW === 'number' && typeof parsed.hoursPerDay === 'number' && typeof parsed.daysPerMonth === 'number') {
    const additionalMonthlyKwh = Number(((parsed.powerW / 1000) * parsed.hoursPerDay * parsed.daysPerMonth).toFixed(3));
    return {
      additionalMonthlyKwh,
      usageFormula: `${parsed.powerW}W / 1000 * ${parsed.hoursPerDay}시간/일 * ${parsed.daysPerMonth}일 = ${additionalMonthlyKwh}kWh`
    };
  }

  return {};
}

export function estimateBill(input: BillEstimateInput): BillEstimateResult {
  const parsed = parseUsageRequest(input);
  const tariff = getResidentialTariff(parsed.voltageType, parsed.season);
  const { additionalMonthlyKwh, usageFormula } = deriveAdditionalKwh(parsed);

  const result: BillEstimateResult = {
    parsed,
    additionalMonthlyKwh,
    recommendations: buildRecommendations(parsed, additionalMonthlyKwh),
    tariffBasis: {
      basisDate: tariff.basisDate,
      sourceLabel: tariff.sourceLabel,
      sourceUrl: tariff.sourceUrl,
      notes: tariff.notes
    },
    disclaimer: '공식 청구액이 아닌 MCP 간이 추정입니다. 실제 납부액은 한전ON에서 확인해야 합니다.'
  };

  if (typeof parsed.baseMonthlyKwh === 'number') {
    result.currentBill = calculateResidentialBill({
      monthlyKwh: parsed.baseMonthlyKwh,
      voltageType: parsed.voltageType,
      season: parsed.season,
      climateEnvironmentWonPerKwh: input.climateEnvironmentWonPerKwh,
      fuelAdjustmentWonPerKwh: input.fuelAdjustmentWonPerKwh
    });
    const voltageLabel = parsed.voltageType === 'low_voltage' ? '주택용 저압' : '주택용 고압';
    result.currentBillSummary = summarizeBill(`${parsed.billingMonth}월 ${voltageLabel} ${parsed.baseMonthlyKwh}kWh`, result.currentBill);
  }

  if (typeof additionalMonthlyKwh !== 'number') {
    return result;
  }

  result.usageFormula = usageFormula;

  if (typeof parsed.baseMonthlyKwh === 'number') {
    const beforeBill = result.currentBill;
    if (!beforeBill) {
      return result;
    }
    const afterBill = calculateResidentialBill({
      monthlyKwh: Math.max(0, parsed.baseMonthlyKwh + additionalMonthlyKwh),
      voltageType: parsed.voltageType,
      season: parsed.season,
      climateEnvironmentWonPerKwh: input.climateEnvironmentWonPerKwh,
      fuelAdjustmentWonPerKwh: input.fuelAdjustmentWonPerKwh
    });
    result.beforeBill = beforeBill;
    result.afterBill = afterBill;
    result.increaseWon = afterBill.estimatedTotalWon - beforeBill.estimatedTotalWon;
    result.increasePercent =
      beforeBill.estimatedTotalWon > 0 ? Number(((result.increaseWon / beforeBill.estimatedTotalWon) * 100).toFixed(1)) : undefined;
  } else {
    result.marginalScenarios = [200, 300, 400, 500].map((base) => {
      const before = calculateResidentialBill({ monthlyKwh: base, voltageType: parsed.voltageType, season: parsed.season });
      const afterMonthlyKwh = Math.max(0, base + additionalMonthlyKwh);
      const after = calculateResidentialBill({
        monthlyKwh: afterMonthlyKwh,
        voltageType: parsed.voltageType,
        season: parsed.season
      });
      return {
        assumedBaseMonthlyKwh: base,
        afterMonthlyKwh: Number(afterMonthlyKwh.toFixed(3)),
        estimatedIncreaseWon: after.estimatedTotalWon - before.estimatedTotalWon
      };
    });
  }

  return result;
}

export function compareUsageScenarios(input: {
  text?: string;
  applianceName?: string;
  powerW?: number;
  baseMonthlyKwh?: number;
  voltageType?: VoltageType;
  billingMonth?: number;
  scenarioHoursPerDay?: number[];
  scenarioDaysPerMonth?: number[];
  daysPerMonth?: number;
}): {
  scenarios: Array<{
    label: string;
    hoursPerDay: number;
    daysPerMonth: number;
    additionalMonthlyKwh: number;
    estimatedIncreaseWon?: number;
    assumedAfterMonthlyKwh?: number;
  }>;
  usageBillComparisons?: Array<{
    monthlyKwh: number;
    estimatedTotalWon: number;
    differenceFromPreviousWon?: number;
  }>;
  directIncreaseScenarios?: Array<{
    assumedBaseMonthlyKwh: number;
    afterMonthlyKwh: number;
    estimatedIncreaseWon: number;
  }>;
  baseAssumption?: string;
  recommendations: string[];
} {
  const parsed = parseUsageRequest({
    text: input.text,
    applianceName: input.applianceName,
    powerW: input.powerW,
    baseMonthlyKwh: input.baseMonthlyKwh,
    voltageType: input.voltageType,
    billingMonth: input.billingMonth,
    daysPerMonth: input.daysPerMonth
  });

  const directChangeKwh = parsed.additionalMonthlyKwhDirect;
  const kwhValues = extractKwhValues(input.text ?? '');
  if (typeof directChangeKwh !== 'number' && kwhValues.length >= 2 && typeof input.powerW !== 'number' && typeof parsed.powerW !== 'number') {
    const comparisons = kwhValues.slice(0, 8).map((monthlyKwh, index, values) => {
      const bill = calculateResidentialBill({
        monthlyKwh,
        voltageType: parsed.voltageType,
        season: parsed.season
      });
      const previousKwh = values[index - 1];
      const previousBill =
        typeof previousKwh === 'number'
          ? calculateResidentialBill({ monthlyKwh: previousKwh, voltageType: parsed.voltageType, season: parsed.season })
          : undefined;
      return {
        monthlyKwh,
        estimatedTotalWon: bill.estimatedTotalWon,
        differenceFromPreviousWon: previousBill ? bill.estimatedTotalWon - previousBill.estimatedTotalWon : undefined
      };
    });
    return {
      scenarios: [],
      usageBillComparisons: comparisons,
      baseAssumption: `${parsed.billingMonth}월 ${parsed.voltageType === 'low_voltage' ? '주택용 저압' : '주택용 고압'} 기준 월 사용량별 요금 비교`,
      recommendations: ['월 사용량 비교는 한전 주택용 요금표 기반 간이 추정이며, 복지할인/공동주택 계약방식/TV수신료 등은 별도입니다.']
    };
  }

  if (typeof directChangeKwh === 'number' && typeof input.powerW !== 'number' && typeof parsed.powerW !== 'number') {
    const changeKwh = directChangeKwh;
    const baseScenarios = typeof parsed.baseMonthlyKwh === 'number' ? [parsed.baseMonthlyKwh] : [200, 300, 400, 500];
    const directIncreaseScenarios = baseScenarios.map((base) => {
      const before = calculateResidentialBill({ monthlyKwh: base, voltageType: parsed.voltageType, season: parsed.season });
      const afterMonthlyKwh = Math.max(0, base + changeKwh);
      const after = calculateResidentialBill({
        monthlyKwh: afterMonthlyKwh,
        voltageType: parsed.voltageType,
        season: parsed.season
      });
      return {
        assumedBaseMonthlyKwh: base,
        afterMonthlyKwh: Number(afterMonthlyKwh.toFixed(3)),
        estimatedIncreaseWon: after.estimatedTotalWon - before.estimatedTotalWon
      };
    });
    return {
      scenarios: [],
      directIncreaseScenarios,
      baseAssumption:
        typeof parsed.baseMonthlyKwh === 'number'
          ? `기존 월 사용량 ${parsed.baseMonthlyKwh}kWh에서 ${changeKwh}kWh 변화`
          : `기존 월 사용량을 모르는 상태에서 ${changeKwh}kWh 변화분만 기준별로 비교`,
      recommendations: ['현재 월 사용량을 함께 넣으면 실제 누진 구간에 맞춘 증가액을 더 정확히 계산할 수 있습니다.']
    };
  }

  const hours = input.scenarioHoursPerDay && input.scenarioHoursPerDay.length > 0 ? input.scenarioHoursPerDay : [4, 8, 12, 24];
  const dayScenarios = (input.scenarioDaysPerMonth ?? parseScenarioDays(input.text))?.filter((days) => days > 0 && days <= 31);
  const days = input.daysPerMonth ?? parsed.daysPerMonth ?? 30;
  const powerW = input.powerW ?? parsed.powerW;

  if (typeof powerW !== 'number') {
    return {
      scenarios: [],
      recommendations: ['소비전력(W 또는 kW)을 알려주면 사용시간별 요금 증가 시나리오를 계산할 수 있습니다.']
    };
  }

  if (dayScenarios && dayScenarios.length > 0 && typeof parsed.hoursPerDay !== 'number' && !input.scenarioHoursPerDay?.length) {
    return {
      scenarios: [],
      recommendations: ['사용일수별 비교에는 하루 사용시간이 필요합니다. 예: "1500W 제품을 하루 2시간씩 10일, 20일, 30일 비교해줘".']
    };
  }

  const scenarioInputs =
    dayScenarios && dayScenarios.length > 0
      ? dayScenarios.map((scenarioDays) => ({ hour: parsed.hoursPerDay ?? hours[0] ?? 1, days: scenarioDays }))
      : hours.map((hour) => ({ hour, days }));

  const scenarios = scenarioInputs.map(({ hour, days: scenarioDays }) => {
    const additionalMonthlyKwh = Number(((powerW / 1000) * hour * scenarioDays).toFixed(3));
    const item: {
      label: string;
      hoursPerDay: number;
      daysPerMonth: number;
      additionalMonthlyKwh: number;
      estimatedIncreaseWon?: number;
      assumedAfterMonthlyKwh?: number;
    } = {
      label: `${hour}시간/일 * ${scenarioDays}일`,
      hoursPerDay: hour,
      daysPerMonth: scenarioDays,
      additionalMonthlyKwh
    };
    if (typeof parsed.baseMonthlyKwh === 'number') {
      const before = calculateResidentialBill({
        monthlyKwh: parsed.baseMonthlyKwh,
        voltageType: parsed.voltageType,
        season: parsed.season
      });
      const afterMonthlyKwh = Math.max(0, parsed.baseMonthlyKwh + additionalMonthlyKwh);
      const after = calculateResidentialBill({
        monthlyKwh: afterMonthlyKwh,
        voltageType: parsed.voltageType,
        season: parsed.season
      });
      item.estimatedIncreaseWon = after.estimatedTotalWon - before.estimatedTotalWon;
      item.assumedAfterMonthlyKwh = Number(afterMonthlyKwh.toFixed(3));
    }
    return item;
  });

  return {
    scenarios,
    baseAssumption:
      typeof parsed.baseMonthlyKwh === 'number'
        ? `기존 월 사용량 ${parsed.baseMonthlyKwh}kWh 기준`
        : '기존 월 사용량이 없어 kWh 증가량만 비교했습니다.',
    recommendations: buildRecommendations(parsed)
  };
}
