import { calculateResidentialBill } from './billCalculator.js';
import type { Season, VoltageType } from './kepcoData.js';
import { buildUnavailableApiMessage, getApiReadiness, getPublicApis, type ApiDataMode } from './publicApis.js';

export interface HomeUsageCompareInput {
  text?: string;
  monthlyKwh?: number;
  householdSize?: number;
  region?: string;
  month?: number;
  season?: Season;
  voltageType?: VoltageType;
  benchmarkMonthlyKwh?: number;
  benchmarkLabel?: string;
}

type HomeUsageLevel = 'low' | 'normal' | 'high' | 'very_high';

export interface HomeUsageCompareResult {
  dataMode: ApiDataMode;
  parsed: {
    monthlyKwh?: number;
    householdSize?: number;
    region?: string;
    month?: number;
    season: Season;
    voltageType: VoltageType;
    benchmarkMonthlyKwh?: number;
  };
  comparison?: {
    benchmarkLabel: string;
    differenceKwh: number;
    differencePercent: number;
    level: HomeUsageLevel;
    estimatedBillWon?: number;
    benchmarkBillWon?: number;
  };
  answerSummary: string;
  userFacingSummary: string[];
  clarifyingQuestions: string[];
  recommendations: string[];
  requiredApis: ReturnType<typeof getPublicApis>;
  apiReadiness: ReturnType<typeof getApiReadiness>;
  disclaimer: string;
}

function getCurrentKoreanMonth(): number {
  return new Date().getMonth() + 1;
}

function inferSeason(month: number): Season {
  return month === 7 || month === 8 ? 'summer' : 'other';
}

function numberFrom(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? Number.parseFloat(match[1].replace(',', '')) : undefined;
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function parseHomeUsageInput(input: HomeUsageCompareInput): Required<Pick<HomeUsageCompareResult, 'parsed'>>['parsed'] {
  const text = input.text ?? '';
  const month = input.month ?? numberFrom(text, [/(\d{1,2})\s*월/]) ?? getCurrentKoreanMonth();
  const monthlyKwh =
    input.monthlyKwh ??
    numberFrom(text.replace(/,/g, ''), [
      /(\d+(?:\.\d+)?)\s*kwh/i,
      /(\d+(?:\.\d+)?)\s*킬로와트시/,
      /(\d+(?:\.\d+)?)\s*정도/
    ]);
  const householdSize =
    input.householdSize ??
    numberFrom(text, [
      /(\d+)\s*인\s*가구/,
      /(\d+)\s*명/,
      /(\d+)\s*인가족/
    ]);
  const benchmarkMonthlyKwh =
    input.benchmarkMonthlyKwh ??
    numberFrom(text.replace(/,/g, ''), [
      /평균(?:은|이)?\s*(\d+(?:\.\d+)?)\s*kwh/i,
      /기준(?:은|이)?\s*(\d+(?:\.\d+)?)\s*kwh/i
    ]);

  return {
    monthlyKwh,
    householdSize,
    region: input.region,
    month,
    season: input.season ?? inferSeason(month),
    voltageType: input.voltageType ?? 'low_voltage',
    benchmarkMonthlyKwh
  };
}

function usageLevel(differencePercent: number): HomeUsageLevel {
  if (differencePercent >= 30) return 'very_high';
  if (differencePercent >= 10) return 'high';
  if (differencePercent <= -20) return 'low';
  return 'normal';
}

export function compareHomeElectricityUsage(input: HomeUsageCompareInput): HomeUsageCompareResult {
  const parsed = parseHomeUsageInput(input);
  const requiredApis = getPublicApis({ feature: 'compare_home_usage' });
  const apiReadiness = getApiReadiness({ feature: 'compare_home_usage' });
  const benchmarkLabel = input.benchmarkLabel ?? '공개 평균 사용량 기준';

  if (typeof parsed.monthlyKwh !== 'number') {
    return {
      dataMode: 'unavailable',
      parsed,
      answerSummary: '비교할 월 사용량(kWh)이 필요합니다.',
      userFacingSummary: ['가구 평균 비교를 위해 월 사용량(kWh)이 필요합니다.', '예: 우리집 420kWh고 평균은 310kWh라고 가정해서 비교해줘'],
      clarifyingQuestions: ['비교할 월 사용량(kWh)을 알려주세요.'],
      recommendations: ['예: "우리집 420kWh 썼는데 평균보다 많아?"처럼 월 사용량을 같이 입력해 주세요.'],
      requiredApis,
      apiReadiness,
      disclaimer: '개인 고객 사용량은 조회하지 않으며, 사용자가 입력한 사용량만 분석합니다.'
    };
  }

  if (typeof parsed.benchmarkMonthlyKwh !== 'number') {
    return {
      dataMode: 'unavailable',
      parsed,
      answerSummary: buildUnavailableApiMessage('가구 평균 전력사용량 비교', ['K2', 'K3', 'K4']),
      userFacingSummary: [
        `${parsed.monthlyKwh}kWh 사용량은 확인했습니다.`,
        '비교 기준 평균 사용량이 필요합니다.',
        '공공 평균 사용량 API 연동 전에는 benchmarkMonthlyKwh를 직접 입력해야 합니다.'
      ],
      clarifyingQuestions: ['비교 기준이 되는 평균 월 사용량(kWh)을 알려주거나, 공공 평균 사용량 API 연동 후 다시 조회해 주세요.'],
      recommendations: [
        '현재는 임의 평균값을 넣지 않습니다.',
        '공공 API 연동 전 테스트하려면 benchmarkMonthlyKwh를 명시해 비교할 수 있습니다.',
        '예: "우리집 420kWh고 평균은 310kWh라고 가정해서 비교해줘".'
      ],
      requiredApis,
      apiReadiness,
      disclaimer: '공개 통계 비교 기능이며 개인 고객번호 기반 조회는 수행하지 않습니다.'
    };
  }

  const differenceKwh = Number((parsed.monthlyKwh - parsed.benchmarkMonthlyKwh).toFixed(3));
  const differencePercent = Number(((differenceKwh / parsed.benchmarkMonthlyKwh) * 100).toFixed(1));
  const level = usageLevel(differencePercent);
  const estimatedBill = calculateResidentialBill({
    monthlyKwh: parsed.monthlyKwh,
    voltageType: parsed.voltageType,
    season: parsed.season
  });
  const benchmarkBill = calculateResidentialBill({
    monthlyKwh: parsed.benchmarkMonthlyKwh,
    voltageType: parsed.voltageType,
    season: parsed.season
  });

  const levelText =
    level === 'very_high'
      ? '평균보다 많이 높은 편'
      : level === 'high'
        ? '평균보다 높은 편'
        : level === 'low'
          ? '평균보다 낮은 편'
          : '평균과 비슷한 편';

  return {
    dataMode: 'user_provided',
    parsed,
    comparison: {
      benchmarkLabel,
      differenceKwh,
      differencePercent,
      level,
      estimatedBillWon: estimatedBill.estimatedTotalWon,
      benchmarkBillWon: benchmarkBill.estimatedTotalWon
    },
    answerSummary: `${parsed.monthlyKwh}kWh는 ${benchmarkLabel} ${parsed.benchmarkMonthlyKwh}kWh 대비 ${Math.abs(differenceKwh)}kWh ${differenceKwh >= 0 ? '많고' : '적고'}, 약 ${Math.abs(differencePercent)}% ${differenceKwh >= 0 ? '높습니다' : '낮습니다'}. 판정은 ${levelText}입니다.`,
    userFacingSummary: [
      `${parsed.monthlyKwh}kWh는 기준 ${parsed.benchmarkMonthlyKwh}kWh보다 ${Math.abs(differenceKwh)}kWh ${differenceKwh >= 0 ? '많습니다' : '적습니다'}.`,
      `차이는 약 ${Math.abs(differencePercent)}%이고 판정은 ${levelText}입니다.`,
      `예상 요금은 ${estimatedBill.estimatedTotalWon.toLocaleString('ko-KR')}원입니다.`
    ],
    clarifyingQuestions: [],
    recommendations: [
      level === 'very_high' || level === 'high'
        ? '에어컨, 제습기, 전기난방, 건조기처럼 월 사용량을 크게 올리는 기기를 먼저 점검하세요.'
        : '현재 사용량은 평균 대비 과도한 수준은 아닙니다. 누진구간 진입 여부와 계절 요인을 함께 보면 좋습니다.',
      '정확한 평균 비교는 K2/K3/K4 공공 API 연동 후 지역, 가구원수, 계절 기준으로 보정해야 합니다.'
    ],
    requiredApis,
    apiReadiness,
    disclaimer: '현재 비교는 사용자가 제공한 평균 기준값을 사용합니다. 공공 API 연동 전 임의 평균값은 사용하지 않습니다.'
  };
}
