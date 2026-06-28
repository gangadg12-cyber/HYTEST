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

export function parseUsageRequest(input: BillEstimateInput): ParsedUsageRequest {
  const text = input.text?.trim() ?? '';
  const normalized = text.replace(/,/g, '');
  const compactText = compact(normalized);
  const assumptions: string[] = [];

  const appliance = input.applianceName ? { applianceName: input.applianceName } : inferAppliance(normalized);
  let applianceName = input.applianceName ?? appliance.applianceName;

  let powerW = input.powerW;
  const kw = parseNumberNear(normalized, [/(\d+(?:\.\d+)?)\s*(?:kw(?!h)|킬로와트(?!시))/i]);
  const watt = parseNumberNear(normalized, [/(\d+(?:\.\d+)?)\s*(?:w|W|와트)/]);
  if (typeof powerW !== 'number') {
    if (typeof kw === 'number') {
      powerW = kw * 1000;
    } else if (typeof watt === 'number') {
      powerW = watt;
    } else if (typeof appliance.powerW === 'number') {
      powerW = appliance.powerW;
      if (appliance.note) {
        assumptions.push(appliance.note);
      }
    }
  }

  if (!applianceName && text) {
    const candidate = normalized.match(/([가-힣A-Za-z0-9+\- ]{2,20})(?:을|를|이|가)?\s*(?:하루|매일|종일|사용|틀)/);
    applianceName = candidate?.[1]?.trim();
  }

  let hoursPerDay = input.hoursPerDay;
  if (typeof hoursPerDay !== 'number') {
    hoursPerDay = parseNumberNear(normalized, [
      /하루\s*(\d+(?:\.\d+)?)\s*시간/,
      /매일\s*(\d+(?:\.\d+)?)\s*시간/,
      /(\d+(?:\.\d+)?)\s*시간씩/,
      /(\d+(?:\.\d+)?)\s*시간/
    ]);
    if (typeof hoursPerDay !== 'number' && /(하루종일|하루 종일|종일|24시간)/.test(normalized)) {
      hoursPerDay = 24;
      assumptions.push('사용시간은 "하루 종일" 표현을 24시간/일로 해석했습니다.');
    }
  }

  let daysPerMonth = input.daysPerMonth;
  if (typeof daysPerMonth !== 'number') {
    daysPerMonth = parseNumberNear(normalized, [/(\d+(?:\.\d+)?)\s*일\s*(?:동안|간|사용)?/]);
    if (typeof daysPerMonth !== 'number' && /(한달|한 달|매일|월내내|매달)/.test(compactText)) {
      daysPerMonth = 30;
      assumptions.push('사용일수는 한 달 매일 사용 기준 30일로 계산했습니다.');
    }
  }

  let baseMonthlyKwh = input.baseMonthlyKwh;
  if (typeof baseMonthlyKwh !== 'number') {
    baseMonthlyKwh = parseNumberNear(normalized, [
      /(?:기존|현재|평소|이번달|월)\s*(?:사용량|전력량)?\s*(\d+(?:\.\d+)?)\s*(?:kwh|KWh|KWH|킬로와트시)/i,
      /(\d+(?:\.\d+)?)\s*(?:kwh|킬로와트시)\s*(?:정도|쓰|사용)/i
    ]);
  }

  let billingMonth = input.billingMonth;
  if (typeof billingMonth !== 'number') {
    billingMonth = parseNumberNear(normalized, [/(\d{1,2})\s*월/]);
  }
  if (typeof billingMonth !== 'number' && /(여름|하계|폭염|에어컨)/.test(normalized)) {
    billingMonth = 7;
    assumptions.push('에어컨/여름 표현이 있어 7월 하계 구간으로 계산했습니다.');
  }
  if (typeof billingMonth !== 'number') {
    billingMonth = getCurrentKoreanMonth();
    assumptions.push(`청구월 입력이 없어 현재 월(${billingMonth}월) 기준으로 계산했습니다.`);
  }

  const voltageType = input.voltageType ?? (/(고압|아파트\s*고압)/.test(normalized) ? 'high_voltage' : 'low_voltage');
  if (!input.voltageType && voltageType === 'low_voltage') {
    assumptions.push('전압 구분 입력이 없어 주택용 저압 기준으로 계산했습니다.');
  }

  const hasUsageDetail = typeof powerW === 'number' || typeof hoursPerDay === 'number' || typeof daysPerMonth === 'number';
  const isCurrentBillOnlyQuery = typeof baseMonthlyKwh === 'number' && !hasUsageDetail && !input.applianceName && !appliance.applianceName;
  if (isCurrentBillOnlyQuery) {
    applianceName = undefined;
  }

  const missingFields: string[] = [];
  if (!isCurrentBillOnlyQuery) {
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

  return {
    applianceName,
    powerW,
    hoursPerDay,
    daysPerMonth,
    baseMonthlyKwh,
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
  const charge = calculateEnergyCharge(input.monthlyKwh, input.voltageType, input.season);
  const climateUnit = input.climateEnvironmentWonPerKwh ?? tariff.climateEnvironmentWonPerKwh;
  const fuelUnit = input.fuelAdjustmentWonPerKwh ?? tariff.fuelAdjustmentWonPerKwh;
  const climateEnvironmentChargeWon = roundWon(input.monthlyKwh * climateUnit);
  const fuelAdjustmentChargeWon = roundWon(input.monthlyKwh * fuelUnit);
  const electricityChargeBeforeTaxWon =
    charge.basicChargeWon + charge.energyChargeWon + climateEnvironmentChargeWon + fuelAdjustmentChargeWon;
  const vatWon = roundWon(electricityChargeBeforeTaxWon * tariff.vatRate);
  const powerIndustryFundWon = floorToTen(electricityChargeBeforeTaxWon * tariff.powerIndustryFundRate);

  return {
    monthlyKwh: Number(input.monthlyKwh.toFixed(3)),
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
    tips.push('에어컨은 설정온도 1~2도 상향, 선풍기 병행, 필터 청소, 외출 시 연속/예약 운전 비교가 요금 절감에 유효합니다.');
  }
  if (typeof parsed.baseMonthlyKwh === 'number' && typeof additionalKwh === 'number') {
    const after = parsed.baseMonthlyKwh + additionalKwh;
    if (parsed.season === 'summer' && parsed.baseMonthlyKwh <= 450 && after > 450) {
      tips.push('하계 450kWh 초과 구간으로 넘어가면 추가 사용분 단가가 커지므로 사용시간을 줄이는 효과가 큽니다.');
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

export function estimateBill(input: BillEstimateInput): BillEstimateResult {
  const parsed = parseUsageRequest(input);
  const tariff = getResidentialTariff(parsed.voltageType, parsed.season);
  const { powerW, hoursPerDay, daysPerMonth } = parsed;
  let additionalMonthlyKwh: number | undefined;
  let usageFormula: string | undefined;

  if (typeof powerW === 'number' && typeof hoursPerDay === 'number' && typeof daysPerMonth === 'number') {
    additionalMonthlyKwh = Number(((powerW / 1000) * hoursPerDay * daysPerMonth).toFixed(3));
    usageFormula = `${powerW}W / 1000 * ${hoursPerDay}시간/일 * ${daysPerMonth}일 = ${additionalMonthlyKwh}kWh`;
  }

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
      monthlyKwh: parsed.baseMonthlyKwh + additionalMonthlyKwh,
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
      const after = calculateResidentialBill({
        monthlyKwh: base + additionalMonthlyKwh,
        voltageType: parsed.voltageType,
        season: parsed.season
      });
      return {
        assumedBaseMonthlyKwh: base,
        afterMonthlyKwh: Number((base + additionalMonthlyKwh).toFixed(3)),
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
      const after = calculateResidentialBill({
        monthlyKwh: parsed.baseMonthlyKwh + additionalMonthlyKwh,
        voltageType: parsed.voltageType,
        season: parsed.season
      });
      item.estimatedIncreaseWon = after.estimatedTotalWon - before.estimatedTotalWon;
      item.assumedAfterMonthlyKwh = Number((parsed.baseMonthlyKwh + additionalMonthlyKwh).toFixed(3));
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
