import { calculateResidentialBill } from './billCalculator.js';
import { buildUnavailableApiMessage, getApiReadiness, getPublicApis, type ApiDataMode } from './publicApis.js';
import type { Season, VoltageType } from './kepcoData.js';

export interface SolarRegionInput {
  text?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  solarCapacityKw?: number;
  averageDailyGenerationKwhPerKw?: number;
  averageDailySunHours?: number;
  currentMonthlyKwh?: number;
  voltageType?: VoltageType;
  season?: Season;
}

export interface SolarRegionResult {
  dataMode: ApiDataMode;
  parsed: {
    region?: string;
    latitude?: number;
    longitude?: number;
    solarCapacityKw: number;
    averageDailyGenerationKwhPerKw?: number;
    averageDailySunHours?: number;
    currentMonthlyKwh?: number;
    voltageType: VoltageType;
    season: Season;
  };
  generation?: {
    expectedMonthlyGenerationKwh: number;
    selfConsumptionAssumption: string;
  };
  billSaving?: {
    beforeBillWon: number;
    afterBillWon: number;
    estimatedSavingWon: number;
    afterMonthlyGridKwh: number;
  };
  suitability: 'good' | 'moderate' | 'needs_data';
  answerSummary: string;
  userFacingSummary: string[];
  clarifyingQuestions: string[];
  recommendations: string[];
  requiredApis: ReturnType<typeof getPublicApis>;
  apiReadiness: ReturnType<typeof getApiReadiness>;
  disclaimer: string;
}

function numberFrom(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? Number.parseFloat(match[1].replace(',', '')) : undefined;
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function inferSeason(): Season {
  const month = new Date().getMonth() + 1;
  return month === 7 || month === 8 ? 'summer' : 'other';
}

function parseCurrentMonthlyKwh(text: string): number | undefined {
  const normalized = text.replace(/,/g, '');
  return numberFrom(normalized, [
    /(?:현재|우리집|월|한달|이번달|지난달|사용량|전기)\s*(?:전기)?\s*(?:사용량)?\s*(?:이|은|는|가)?\s*(\d+(?:\.\d+)?)\s*kwh/i,
    /(\d+(?:\.\d+)?)\s*kwh\s*(?:쓰|사용|나오|썼|쓴|정도\s*쓰)/i
  ]);
}

function isGenerationPerKwValue(text: string, value?: number): boolean {
  if (typeof value !== 'number') {
    return false;
  }
  const escapedValue = String(value).replace('.', '\\.');
  return new RegExp(`(?:kw당|1kw당)\\s*${escapedValue}\\s*kwh`, 'i').test(text);
}

function parseSolarInput(input: SolarRegionInput): SolarRegionResult['parsed'] {
  const text = input.text ?? '';
  const solarCapacityKw =
    input.solarCapacityKw ??
    numberFrom(text, [
      /(\d+(?:\.\d+)?)\s*kw\s*(?:태양광|설비|패널)?/i,
      /(\d+(?:\.\d+)?)\s*킬로와트/
    ]) ??
    3;
  const averageDailyGenerationKwhPerKw =
    input.averageDailyGenerationKwhPerKw ??
    numberFrom(text, [
      /kw당\s*(\d+(?:\.\d+)?)\s*kwh/i,
      /1kw당\s*(\d+(?:\.\d+)?)/
    ]);
  const rawCurrentMonthlyKwh = input.currentMonthlyKwh ?? parseCurrentMonthlyKwh(text);
  const currentMonthlyKwh = isGenerationPerKwValue(text, rawCurrentMonthlyKwh) ? undefined : rawCurrentMonthlyKwh;
  return {
    region: input.region,
    latitude: input.latitude,
    longitude: input.longitude,
    solarCapacityKw,
    averageDailyGenerationKwhPerKw,
    averageDailySunHours:
      input.averageDailySunHours ??
      numberFrom(text, [
        /일사(?:량|시간).*?(\d+(?:\.\d+)?)/,
        /하루\s*(\d+(?:\.\d+)?)\s*시간.*?태양/
      ]),
    currentMonthlyKwh,
    voltageType: input.voltageType ?? 'low_voltage',
    season: input.season ?? inferSeason()
  };
}

export function checkSolarRegion(input: SolarRegionInput): SolarRegionResult {
  const parsed = parseSolarInput(input);
  const requiredApis = getPublicApis({ feature: 'solar_region_checker' });
  const apiReadiness = getApiReadiness({ feature: 'solar_region_checker' });
  const dailyGenerationPerKw =
    parsed.averageDailyGenerationKwhPerKw ??
    (typeof parsed.averageDailySunHours === 'number' ? parsed.averageDailySunHours * 0.75 : undefined);

  if (typeof dailyGenerationPerKw !== 'number') {
    return {
      dataMode: 'unavailable',
      parsed,
      suitability: 'needs_data',
      answerSummary: buildUnavailableApiMessage('태양광 지역 진단', ['S1', 'S2', 'S3', 'S4', 'K1']),
      userFacingSummary: [
        `${parsed.solarCapacityKw}kW 태양광 조건은 확인했습니다.`,
        '발전량 계산에는 kw당 하루 발전량 또는 평균 일사시간이 필요합니다.',
        '공공 API 연동 전에는 임의 일사량을 사용하지 않습니다.'
      ],
      clarifyingQuestions: ['지역/좌표와 kw당 하루 발전량 또는 평균 일사시간을 알려주세요.'],
      recommendations: [
        '태양광 기능은 임의 일사량/발전량을 넣지 않습니다.',
        '공공 API 연동 전에는 averageDailyGenerationKwhPerKw 또는 averageDailySunHours를 직접 입력해야 절감액 계산이 가능합니다.',
        '예: "3kW 태양광, kw당 하루 3.5kWh 발전한다고 가정하고 420kWh 요금 절감액 계산해줘".'
      ],
      requiredApis,
      apiReadiness,
      disclaimer: '개별 부지의 음영, 지붕 방향, 계통연계 가능성, 인허가 조건은 별도 검토가 필요합니다.'
    };
  }

  const expectedMonthlyGenerationKwh = Number((parsed.solarCapacityKw * dailyGenerationPerKw * 30).toFixed(3));
  let billSaving: SolarRegionResult['billSaving'];
  if (typeof parsed.currentMonthlyKwh === 'number') {
    const beforeBill = calculateResidentialBill({
      monthlyKwh: parsed.currentMonthlyKwh,
      voltageType: parsed.voltageType,
      season: parsed.season
    });
    const afterMonthlyGridKwh = Math.max(0, parsed.currentMonthlyKwh - expectedMonthlyGenerationKwh);
    const afterBill = calculateResidentialBill({
      monthlyKwh: afterMonthlyGridKwh,
      voltageType: parsed.voltageType,
      season: parsed.season
    });
    billSaving = {
      beforeBillWon: beforeBill.estimatedTotalWon,
      afterBillWon: afterBill.estimatedTotalWon,
      estimatedSavingWon: beforeBill.estimatedTotalWon - afterBill.estimatedTotalWon,
      afterMonthlyGridKwh: Number(afterMonthlyGridKwh.toFixed(3))
    };
  }

  const suitability = dailyGenerationPerKw >= 3.5 ? 'good' : dailyGenerationPerKw >= 2.5 ? 'moderate' : 'needs_data';
  const suitabilityText = suitability === 'good' ? '양호' : suitability === 'moderate' ? '보통' : '추가 확인 필요';
  return {
    dataMode: 'user_provided',
    parsed,
    generation: {
      expectedMonthlyGenerationKwh,
      selfConsumptionAssumption: 'MVP 계산은 생산 전력 전량을 같은 달 자가소비로 상계한다고 단순 가정합니다.'
    },
    billSaving,
    suitability,
    answerSummary: `${parsed.solarCapacityKw}kW 태양광 기준 월 예상 발전량은 약 ${expectedMonthlyGenerationKwh}kWh입니다. 입지 간단 판정은 ${suitabilityText}입니다.`,
    userFacingSummary: [
      `월 예상 발전량: 약 ${expectedMonthlyGenerationKwh}kWh`,
      `입지 간단 판정: ${suitabilityText}`,
      billSaving ? `단순 요금 절감액: 약 ${billSaving.estimatedSavingWon.toLocaleString('ko-KR')}원` : '현재 월 사용량을 주면 절감액까지 계산 가능합니다.'
    ],
    clarifyingQuestions: typeof parsed.currentMonthlyKwh === 'number' ? [] : ['현재 월 사용량(kWh)을 알려주면 전기요금 절감액까지 계산할 수 있습니다.'],
    recommendations: [
      billSaving
        ? `현재 ${parsed.currentMonthlyKwh}kWh 사용 기준 단순 절감액은 약 ${billSaving.estimatedSavingWon.toLocaleString('ko-KR')}원입니다.`
        : '현재 월 사용량을 입력하면 예상 발전량을 전기요금 절감액으로 환산할 수 있습니다.',
      '실서비스에서는 S1/S2/S3/S4 API로 지역 신재생 현황, 계통 여유, 일사량/발전량 예측을 가져와야 합니다.',
      '최종 설치 가능성은 지붕 방향/음영/구조/계통연계/인허가 검토가 필요합니다.'
    ],
    requiredApis,
    apiReadiness,
    disclaimer: '공식 수익성 산정이 아닌 공공데이터 기반 MVP 추정입니다. 실제 태양광 설치 판단에는 현장 조사와 한전/지자체 절차 확인이 필요합니다.'
  };
}
