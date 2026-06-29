import { compareUsageScenarios, estimateBill } from './billCalculator.js';
import { guideCivilService, prepareApplicationDraft } from './civilService.js';
import { planEvChargingVisitWithLiveData, type ChargerCandidateInput } from './evCharging.js';
import { compareHomeElectricityUsage } from './homeUsage.js';
import type { Season, VoltageType } from './kepcoData.js';
import { analyzeRenewableEnergySale } from './renewableSale.js';
import { checkSolarRegion } from './solar.js';
import { adviseWeatherPowerUsage } from './weatherPower.js';

export type RoutedIntentType =
  | 'electric_bill'
  | 'usage_comparison'
  | 'home_usage_comparison'
  | 'civil_service'
  | 'ev_charging'
  | 'renewable_sale'
  | 'solar_region'
  | 'weather_power'
  | 'unknown';

export type RoutedIntentStatus = 'answered' | 'needs_more_info' | 'unavailable' | 'not_matched';

export interface ElectricLifeRouterInput {
  text: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  origin?: string;
  destination?: string;
  routeName?: string;
  direction?: string;
  arrivalInMinutes?: number;
  desiredKwh?: number;
  connectorType?: string;
  minimumOutputKw?: number;
  candidates?: ChargerCandidateInput[];
  applianceName?: string;
  powerW?: number;
  hoursPerDay?: number;
  daysPerMonth?: number;
  baseMonthlyKwh?: number;
  monthlyKwh?: number;
  benchmarkMonthlyKwh?: number;
  householdSize?: number;
  region?: string;
  month?: number;
  billingMonth?: number;
  season?: Season;
  voltageType?: VoltageType;
  customerNumber?: string;
  address?: string;
  applicantName?: string;
  phone?: string;
  preferredDate?: string;
  details?: string;
  solarCapacityKw?: number;
  averageDailyGenerationKwhPerKw?: number;
  averageDailySunHours?: number;
  expectedAnnualGenerationKwh?: number;
  recWeight?: number;
  smpWonPerKwh?: number;
  recPriceWonPerRec?: number;
  useLiveApi?: boolean;
}

export interface RoutedIntentResult {
  type: RoutedIntentType;
  status: RoutedIntentStatus;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  answerSummary?: string;
  clarifyingQuestions: string[];
  result?: unknown;
}

export interface ElectricLifeRouterResult {
  originalText: string;
  summary: string;
  intents: RoutedIntentResult[];
  nextQuestions: string[];
  routingNotes: string[];
  disclaimer: string;
}

interface IntentCandidate {
  type: RoutedIntentType;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

function compact(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function detectIntents(text: string): IntentCandidate[] {
  const loose = compact(text);
  const candidates: IntentCandidate[] = [];

  const hasUsageUnit = /(\d+(?:\.\d+)?)\s*(?:kwh|kw\s*h|w\b|kw\b|와트|킬로와트시|키로와트)/i.test(text);
  const hasBillWord = hasAny(text, [/전기\s*요금|요금|얼마|청구|전기세|냉방비|난방비|절약|아껴/]);
  const hasComparisonWord = hasAny(text, [/비교|차이|줄이면|줄였|줄여|감소|절감|늘면|늘었|더\s*썼|아껴|시나리오|몇\s*시간/]);
  const hasCivilWord = hasAny(text, [
    /한전|한전ON|민원|신청|명의|이사\s*정산|전기사용신청|증설|계약전력|자동이체|청구서|고객번호|복지할인|정전|전기고장|서류|신청서|양식|FAQ|자주\s*묻/
  ]);
  const hasEvChargingWord = hasAny(text, [/충전소|충전기|급속|완속|dc\s*콤보|dc콤보|차데모|chademo|휴게소|방문\s*플랜|충전\s*예약/]);
  const hasRenewableSaleWord = hasAny(text, [/rec|smp|ppa|판매|팔|수익|계통|분산전원|연계|발전사업|상계거래|신재생\s*판매/]);
  const hasSolarWord = hasAny(text, [/태양광|패널|일사량|발전량|자가소비|kw당/]);
  const hasWeatherWord = hasAny(text, [/폭염|한파|기상|날씨|더위|더워|덥|추위|추워|춥|장마|호우|태풍|냉방|난방/]);
  const hasAverageWord = hasAny(text, [/평균|우리집|우리\s*집|많이\s*쓰|적게\s*쓰|가구/]);

  if (hasUsageUnit && hasComparisonWord) {
    candidates.push({ type: 'usage_comparison', confidence: 'high', reason: '사용량/요금 비교 또는 절감 시나리오 표현 감지' });
  }
  if (hasUsageUnit && hasBillWord && !hasComparisonWord) {
    candidates.push({ type: 'electric_bill', confidence: 'high', reason: 'kWh/W/kW와 요금 질문 표현 감지' });
  }
  if (!hasUsageUnit && hasBillWord && hasAny(text, [/에어컨|건조기|전자레인지|공기청정기|전기장판|히터|냉장고|제습기|전기차/])) {
    candidates.push({ type: 'electric_bill', confidence: 'medium', reason: '제품 사용 요금 질문 표현 감지' });
  }
  if (hasAverageWord && hasUsageUnit) {
    candidates.push({ type: 'home_usage_comparison', confidence: 'medium', reason: '가구/평균 사용량 비교 표현 감지' });
  }
  if (hasCivilWord && !/충전소|충전기/.test(loose)) {
    candidates.push({ type: 'civil_service', confidence: 'high', reason: '한전ON 민원/FAQ/서류 표현 감지' });
  }
  if (hasEvChargingWord) {
    candidates.push({ type: 'ev_charging', confidence: 'high', reason: '전기차 충전소/방문 플랜 표현 감지' });
  }
  if (hasSolarWord && hasRenewableSaleWord) {
    candidates.push({ type: 'renewable_sale', confidence: 'high', reason: '태양광/신재생 판매, REC/SMP, 계통연계 표현 감지' });
  } else if (hasRenewableSaleWord) {
    candidates.push({ type: 'renewable_sale', confidence: 'medium', reason: '발전 판매/계통/REC/SMP 표현 감지' });
  }
  if (hasSolarWord && !hasRenewableSaleWord) {
    candidates.push({ type: 'solar_region', confidence: 'medium', reason: '태양광 설치/발전량/절감 검토 표현 감지' });
  }
  if (hasWeatherWord && (hasBillWord || hasUsageUnit)) {
    candidates.push({ type: 'weather_power', confidence: 'medium', reason: '날씨 기반 전기 사용/요금 위험 표현 감지' });
  }

  if (candidates.length === 0 && (hasUsageUnit || hasBillWord)) {
    candidates.push({ type: 'electric_bill', confidence: 'low', reason: '전기 사용량 또는 요금 관련 단서만 감지' });
  }

  const seen = new Set<RoutedIntentType>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.type)) {
      return false;
    }
    seen.add(candidate.type);
    return true;
  });
}

function extractClarifyingQuestions(result: unknown): string[] {
  if (!result || typeof result !== 'object') {
    return [];
  }
  const record = result as Record<string, unknown>;
  const questions: string[] = [];

  const parsed = record.parsed;
  if (parsed && typeof parsed === 'object') {
    const missingFields = (parsed as Record<string, unknown>).missingFields;
    if (Array.isArray(missingFields)) {
      questions.push(...missingFields.map((field) => `${String(field)}을(를) 알려주세요.`));
    }
  }

  const missingInputs = record.missingInputs;
  if (Array.isArray(missingInputs)) {
    questions.push(...missingInputs.map((field) => `${String(field)}을(를) 알려주세요.`));
  }

  const nextQuestions = record.nextQuestions;
  if (Array.isArray(nextQuestions)) {
    questions.push(...nextQuestions.map(String).slice(0, 5));
  }

  const recommendations = record.recommendations;
  if (record.dataMode === 'unavailable' && Array.isArray(recommendations)) {
    questions.push(...recommendations.map(String).slice(0, 3));
  }

  return unique(questions).filter(Boolean);
}

function statusFromResult(result: unknown): RoutedIntentStatus {
  if (!result || typeof result !== 'object') {
    return 'answered';
  }
  const record = result as Record<string, unknown>;
  if (record.dataMode === 'unavailable') {
    return 'unavailable';
  }
  if (extractClarifyingQuestions(result).length > 0) {
    return 'needs_more_info';
  }
  return 'answered';
}

function summaryFromResult(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  for (const key of ['answerSummary', 'currentBillSummary', 'visitPlanText', 'summaryText']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

async function runIntent(candidate: IntentCandidate, input: ElectricLifeRouterInput): Promise<RoutedIntentResult> {
  const common = { text: input.text };
  let result: unknown;

  if (candidate.type === 'electric_bill') {
    result = estimateBill({
      ...common,
      applianceName: input.applianceName,
      powerW: input.powerW,
      hoursPerDay: input.hoursPerDay,
      daysPerMonth: input.daysPerMonth,
      baseMonthlyKwh: input.baseMonthlyKwh ?? input.monthlyKwh,
      voltageType: input.voltageType,
      billingMonth: input.billingMonth ?? input.month
    });
  } else if (candidate.type === 'usage_comparison') {
    result = compareUsageScenarios({
      ...common,
      applianceName: input.applianceName,
      powerW: input.powerW,
      baseMonthlyKwh: input.baseMonthlyKwh ?? input.monthlyKwh,
      voltageType: input.voltageType,
      billingMonth: input.billingMonth ?? input.month,
      daysPerMonth: input.daysPerMonth
    });
  } else if (candidate.type === 'home_usage_comparison') {
    result = compareHomeElectricityUsage({
      ...common,
      monthlyKwh: input.monthlyKwh ?? input.baseMonthlyKwh,
      householdSize: input.householdSize,
      region: input.region ?? input.locationText,
      month: input.month ?? input.billingMonth,
      season: input.season,
      voltageType: input.voltageType,
      benchmarkMonthlyKwh: input.benchmarkMonthlyKwh
    });
  } else if (candidate.type === 'civil_service') {
    const wantsDraft = /서류|신청서|양식|초안|작성|써줘|채워|항목|무슨\s*의미/.test(input.text);
    const civilInput = {
      text: input.text,
      customerNumber: input.customerNumber,
      address: input.address ?? input.locationText,
      applicantName: input.applicantName,
      phone: input.phone,
      preferredDate: input.preferredDate,
      details: input.details
    };
    result = wantsDraft ? prepareApplicationDraft(civilInput) : guideCivilService(civilInput);
  } else if (candidate.type === 'ev_charging') {
    result = await planEvChargingVisitWithLiveData({
      ...common,
      origin: input.origin,
      destination: input.destination,
      locationText: input.locationText ?? input.region ?? input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      routeName: input.routeName,
      direction: input.direction,
      arrivalInMinutes: input.arrivalInMinutes,
      desiredKwh: input.desiredKwh,
      connectorType: input.connectorType,
      minimumOutputKw: input.minimumOutputKw,
      candidates: input.candidates,
      useLiveApi: input.useLiveApi
    });
  } else if (candidate.type === 'renewable_sale') {
    result = await analyzeRenewableEnergySale({
      ...common,
      locationText: input.locationText ?? input.region ?? input.address,
      solarCapacityKw: input.solarCapacityKw,
      expectedAnnualGenerationKwh: input.expectedAnnualGenerationKwh,
      recWeight: input.recWeight,
      smpWonPerKwh: input.smpWonPerKwh,
      recPriceWonPerRec: input.recPriceWonPerRec,
      useLiveApi: input.useLiveApi
    });
  } else if (candidate.type === 'solar_region') {
    result = checkSolarRegion({
      ...common,
      region: input.region ?? input.locationText,
      latitude: input.latitude,
      longitude: input.longitude,
      solarCapacityKw: input.solarCapacityKw,
      averageDailyGenerationKwhPerKw: input.averageDailyGenerationKwhPerKw,
      averageDailySunHours: input.averageDailySunHours,
      currentMonthlyKwh: input.monthlyKwh ?? input.baseMonthlyKwh,
      voltageType: input.voltageType,
      season: input.season
    });
  } else if (candidate.type === 'weather_power') {
    result = await adviseWeatherPowerUsage({
      ...common,
      locationText: input.locationText ?? input.region ?? input.address,
      baseMonthlyKwh: input.baseMonthlyKwh ?? input.monthlyKwh,
      applianceName: input.applianceName,
      powerW: input.powerW,
      hoursPerDay: input.hoursPerDay,
      daysPerMonth: input.daysPerMonth,
      useLiveApi: input.useLiveApi
    });
  }

  const clarifyingQuestions = extractClarifyingQuestions(result);
  return {
    type: candidate.type,
    status: statusFromResult(result),
    confidence: candidate.confidence,
    reason: candidate.reason,
    answerSummary: summaryFromResult(result),
    clarifyingQuestions,
    result
  };
}

function buildSummary(intents: RoutedIntentResult[]): string {
  if (intents.length === 0 || intents.every((intent) => intent.type === 'unknown')) {
    return '전기요금, 한전 민원, EV 충전, 태양광/신재생 판매 중 어떤 요청인지 확정하지 못했습니다.';
  }
  const answered = intents.filter((intent) => intent.status === 'answered').length;
  const needsMore = intents.filter((intent) => intent.status === 'needs_more_info').length;
  const unavailable = intents.filter((intent) => intent.status === 'unavailable').length;
  return `요청을 ${intents.length}개 intent로 분해했습니다. 처리 완료 ${answered}개, 추가정보 필요 ${needsMore}개, API/데이터 unavailable ${unavailable}개입니다.`;
}

export async function handleElectricLifeRequest(input: ElectricLifeRouterInput): Promise<ElectricLifeRouterResult> {
  const text = input.text.trim();
  const candidates = detectIntents(text);

  if (candidates.length === 0) {
    const unknown: RoutedIntentResult = {
      type: 'unknown',
      status: 'not_matched',
      confidence: 'low',
      reason: '지원 도메인 키워드가 부족합니다.',
      clarifyingQuestions: ['전기요금, 한전 민원, EV 충전소, 태양광/신재생 판매 중 어떤 내용을 처리할지 알려주세요.']
    };
    return {
      originalText: text,
      summary: buildSummary([unknown]),
      intents: [unknown],
      nextQuestions: unknown.clarifyingQuestions,
      routingNotes: ['이 라우터는 PlayMCP LLM의 다중 tool 선택 부담을 줄이기 위한 서버 내부 intent 분해 계층입니다.'],
      disclaimer: '최종 민원 제출, 납부, 충전 예약 확정은 인증/협약 API가 추가되기 전까지 수행하지 않습니다.'
    };
  }

  const intents = await Promise.all(candidates.map((candidate) => runIntent(candidate, input)));
  const nextQuestions = unique(intents.flatMap((intent) => intent.clarifyingQuestions)).slice(0, 10);

  return {
    originalText: text,
    summary: buildSummary(intents),
    intents,
    nextQuestions,
    routingNotes: [
      '라우터 tool 하나를 호출하면 서버가 내부적으로 여러 기능을 분기 실행합니다.',
      '각 세부 결과는 intents[].result에 유지하고, 사용자에게 물어볼 추가 정보는 nextQuestions로 모읍니다.'
    ],
    disclaimer: '공식 API 응답 또는 내장 공식 데이터 기반의 MVP 결과입니다. 실제 한전 민원 제출, 결제, 충전 예약 확정, 발전 판매 계약은 공식 인증/협약 연계가 필요합니다.'
  };
}
