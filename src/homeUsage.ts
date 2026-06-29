import { calculateResidentialBill } from './billCalculator.js';
import {
  fetchKepcoHouseAverageUsage,
  resolveKepcoRegionCodes,
  type KepcoHouseAverageUsage
} from './kepcoBigdata.js';
import type { Season, VoltageType } from './kepcoData.js';
import { buildUnavailableApiMessage, getApiReadiness, getPublicApis, type ApiDataMode } from './publicApis.js';

export interface HomeUsageCompareInput {
  text?: string;
  monthlyKwh?: number;
  householdSize?: number;
  region?: string;
  year?: number;
  month?: number;
  metroCd?: string;
  cityCd?: string;
  season?: Season;
  voltageType?: VoltageType;
  benchmarkMonthlyKwh?: number;
  benchmarkLabel?: string;
  useLiveApi?: boolean;
}

type HomeUsageLevel = 'low' | 'normal' | 'high' | 'very_high';

export interface HomeUsageCompareResult {
  dataMode: ApiDataMode;
  parsed: {
    monthlyKwh?: number;
    householdSize?: number;
    region?: string;
    year?: number;
    month?: number;
    metroCd?: string;
    cityCd?: string;
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
  homeAverageApi?: {
    attempted: boolean;
    used: boolean;
    endpoint?: string;
    year?: string | number;
    month?: string | number;
    metroCd?: string;
    cityCd?: string;
    fetchedCount?: number;
    serviceKeyConfigured: boolean;
    message: string;
    benchmark?: KepcoHouseAverageUsage;
  };
  requiredApis: ReturnType<typeof getPublicApis>;
  apiReadiness: ReturnType<typeof getApiReadiness>;
  disclaimer: string;
}

function getCurrentKoreanMonth(): number {
  return new Date().getMonth() + 1;
}

function getDefaultApiYear(): number {
  return new Date().getFullYear() - 1;
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
  const year = input.year ?? numberFrom(text, [/(20\d{2})\s*년/]) ?? getDefaultApiYear();
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
    year,
    month,
    metroCd: input.metroCd,
    cityCd: input.cityCd,
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

function weightedHomeAverage(records: KepcoHouseAverageUsage[]): KepcoHouseAverageUsage | undefined {
  const usable = records.filter((record) => typeof record.powerUsage === 'number');
  if (!usable.length) {
    return undefined;
  }
  const weightedHouseCnt = usable.reduce((sum, record) => sum + (record.houseCnt ?? 0), 0);
  const powerUsage =
    weightedHouseCnt > 0
      ? usable.reduce((sum, record) => sum + (record.powerUsage ?? 0) * (record.houseCnt ?? 0), 0) / weightedHouseCnt
      : usable.reduce((sum, record) => sum + (record.powerUsage ?? 0), 0) / usable.length;
  const bill =
    weightedHouseCnt > 0
      ? usable.reduce((sum, record) => sum + (record.bill ?? 0) * (record.houseCnt ?? 0), 0) / weightedHouseCnt
      : usable.reduce((sum, record) => sum + (record.bill ?? 0), 0) / usable.length;
  return {
    year: usable[0]?.year,
    month: usable[0]?.month,
    metro: usable[0]?.metro,
    city: usable.length === 1 ? usable[0]?.city : undefined,
    houseCnt: weightedHouseCnt || undefined,
    powerUsage: Number(powerUsage.toFixed(2)),
    bill: Number(bill.toFixed(0))
  };
}

function unavailableWithHomeAverageApi(input: {
  parsed: HomeUsageCompareResult['parsed'];
  answerSummary: string;
  userFacingSummary: string[];
  clarifyingQuestions: string[];
  recommendations: string[];
  homeAverageApi?: HomeUsageCompareResult['homeAverageApi'];
}): HomeUsageCompareResult {
  return {
    dataMode: 'unavailable',
    parsed: input.parsed,
    answerSummary: input.answerSummary,
    userFacingSummary: input.userFacingSummary,
    clarifyingQuestions: input.clarifyingQuestions,
    recommendations: input.recommendations,
    homeAverageApi: input.homeAverageApi,
    requiredApis: getPublicApis({ feature: 'compare_home_usage' }),
    apiReadiness: getApiReadiness({ feature: 'compare_home_usage' }),
    disclaimer: '공개 통계 비교 기능이며 개인 고객번호 기반 조회는 수행하지 않습니다.'
  };
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
        '지역을 알려주면 한전 가구평균 API로 평균 사용량을 조회하고, API 조회를 끈 경우에는 기준 평균값을 직접 입력해야 합니다.'
      ],
      clarifyingQuestions: ['비교할 지역을 알려주거나, 기준 평균 월 사용량(kWh)을 직접 알려주세요.'],
      recommendations: [
        '현재는 임의 평균값을 넣지 않습니다.',
        'API 조회 없이 테스트하려면 benchmarkMonthlyKwh를 명시해 비교할 수 있습니다.',
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
      '정확한 평균 비교는 지역, 조회월, 가구 특성 기준을 함께 맞춰 보는 것이 좋습니다.'
    ],
    requiredApis,
    apiReadiness,
    disclaimer: '현재 비교는 사용자가 제공한 평균 기준값을 사용합니다. 임의 평균값은 사용하지 않습니다.'
  };
}

export async function compareHomeElectricityUsageWithLiveData(input: HomeUsageCompareInput): Promise<HomeUsageCompareResult> {
  const parsed = parseHomeUsageInput(input);

  if (typeof parsed.monthlyKwh !== 'number' || typeof parsed.benchmarkMonthlyKwh === 'number' || input.useLiveApi === false) {
    return compareHomeElectricityUsage(input);
  }

  const regionText = input.region ?? input.text;
  if (!regionText && !input.metroCd) {
    return unavailableWithHomeAverageApi({
      parsed,
      answerSummary: '가구 평균 비교에는 월 사용량과 비교할 지역이 필요합니다.',
      userFacingSummary: [
        `${parsed.monthlyKwh}kWh 사용량은 확인했습니다.`,
        '한전 가구평균 API 조회를 위해 지역이 필요합니다.',
        '예: "서울 강남구 우리집 390kWh면 평균보다 많이 쓰는 편이야?"'
      ],
      clarifyingQuestions: ['비교할 지역을 알려주세요. 예: 서울 강남구, 경기 성남시.'],
      recommendations: ['지역을 주면 한전 전력데이터개방포털 가구평균 API로 평균 사용량과 평균 요금을 조회합니다.']
    });
  }

  const resolved = await resolveKepcoRegionCodes({
    regionText,
    metroCd: input.metroCd,
    cityCd: input.cityCd
  });
  if (!resolved.metroCd) {
    return unavailableWithHomeAverageApi({
      parsed,
      answerSummary: '한전 공통코드에서 지역 코드를 찾지 못해 가구 평균을 조회하지 못했습니다.',
      userFacingSummary: [
        `${parsed.monthlyKwh}kWh 사용량은 확인했습니다.`,
        resolved.message,
        '시도와 시군구를 더 명확히 알려주세요.'
      ],
      clarifyingQuestions: ['지역을 시도/시군구 형태로 다시 알려주세요. 예: 서울 강남구, 부산 해운대구.'],
      recommendations: ['한전 공통코드 API에서 찾을 수 있는 행정구역명으로 입력하면 비교 정확도가 높아집니다.'],
      homeAverageApi: {
        attempted: resolved.attempted,
        used: false,
        serviceKeyConfigured: resolved.attempted,
        message: resolved.message
      }
    });
  }

  const year = parsed.year ?? getDefaultApiYear();
  const month = parsed.month ?? getCurrentKoreanMonth();
  const api = await fetchKepcoHouseAverageUsage({
    year,
    month,
    metroCd: resolved.metroCd,
    cityCd: resolved.cityCd
  });
  const benchmark = weightedHomeAverage(api.records);
  if (!api.used || !benchmark?.powerUsage) {
    return unavailableWithHomeAverageApi({
      parsed: {
        ...parsed,
        region: resolved.cityName ? `${resolved.metroName ?? ''} ${resolved.cityName}`.trim() : resolved.metroName ?? regionText,
        metroCd: resolved.metroCd,
        cityCd: resolved.cityCd
      },
      answerSummary: '한전 가구평균 전력사용량 API에서 비교 기준 데이터를 가져오지 못했습니다.',
      userFacingSummary: [
        `${parsed.monthlyKwh}kWh 사용량은 확인했습니다.`,
        `조회 기준: ${year}년 ${String(month).padStart(2, '0')}월 ${resolved.cityName ? `${resolved.metroName} ${resolved.cityName}` : resolved.metroName}`,
        api.message
      ],
      clarifyingQuestions: ['다른 연월이나 지역으로 다시 조회할까요? 예: 2020년 11월 서울 중구.'],
      recommendations: ['API가 응답하지 않으면 임의 평균값을 만들지 않고 실패 사유를 그대로 반환합니다.'],
      homeAverageApi: {
        attempted: api.attempted,
        used: false,
        endpoint: api.endpoint,
        year,
        month,
        metroCd: resolved.metroCd,
        cityCd: resolved.cityCd,
        fetchedCount: api.records.length,
        serviceKeyConfigured: api.serviceKeyConfigured,
        message: api.message
      }
    });
  }

  const benchmarkLabel = `${benchmark.year ?? year}년 ${benchmark.month ?? String(month).padStart(2, '0')}월 ${
    benchmark.city ? `${benchmark.metro ?? resolved.metroName} ${benchmark.city}` : `${benchmark.metro ?? resolved.metroName} 시도 단위`
  } 가구 평균`;
  const result = compareHomeElectricityUsage({
    ...input,
    year,
    month,
    region: benchmark.city ? `${benchmark.metro ?? resolved.metroName} ${benchmark.city}` : (benchmark.metro ?? resolved.metroName ?? regionText),
    metroCd: resolved.metroCd,
    cityCd: resolved.cityCd,
    benchmarkMonthlyKwh: benchmark.powerUsage,
    benchmarkLabel
  });

  return {
    ...result,
    dataMode: 'live_public_api',
    parsed: {
      ...result.parsed,
      year,
      month,
      region: benchmark.city ? `${benchmark.metro ?? resolved.metroName} ${benchmark.city}` : (benchmark.metro ?? resolved.metroName ?? regionText),
      metroCd: resolved.metroCd,
      cityCd: resolved.cityCd
    },
    homeAverageApi: {
      attempted: api.attempted,
      used: true,
      endpoint: api.endpoint,
      year,
      month,
      metroCd: resolved.metroCd,
      cityCd: resolved.cityCd,
      fetchedCount: api.records.length,
      serviceKeyConfigured: api.serviceKeyConfigured,
      message: api.message,
      benchmark
    },
    recommendations: [
      ...result.recommendations.slice(0, 1),
      '비교 기준은 한전 전력데이터개방포털 가구평균 API 조회값입니다. 개인 고객번호 사용량 조회가 아니라 공개 통계 비교입니다.'
    ],
    disclaimer: '한전 전력데이터개방포털 가구평균 전력사용량 API 기반 공개 통계 비교입니다. 개인 청구서/검침값 조회가 아닙니다.'
  };
}
