import {
  fetchKepcoCommonCodes,
  fetchKepcoDispersedGeneration,
  fetchKepcoRenewableContracts,
  type KepcoCommonCode,
  type KepcoDispersedGeneration,
  type KepcoRenewableContract
} from './kepcoBigdata.js';
import { resolveKakaoLocation, type KakaoLocationResult } from './kakaoLocal.js';
import { getApiReadiness, getPublicApis, type ApiDataMode } from './publicApis.js';
import { ensureArray, fetchStructuredWithTimeout, firstConfiguredEnv, parseFiniteNumber } from './publicApiClient.js';

export interface RenewableSaleInput {
  text?: string;
  locationText?: string;
  year?: number;
  metroCd?: string;
  cityCd?: string;
  addrLidong?: string;
  addrLi?: string;
  addrJibun?: string;
  substCd?: string;
  genSrcCd?: string;
  generationSource?: string;
  solarCapacityKw?: number;
  expectedAnnualGenerationKwh?: number;
  recWeight?: number;
  smpWonPerKwh?: number;
  recPriceWonPerRec?: number;
  useLiveApi?: boolean;
}

export interface RenewableSaleResult {
  dataMode: ApiDataMode;
  parsed: {
    locationText?: string;
    year: number;
    metroCd?: string;
    cityCd?: string;
    genSrcCd: string;
    generationSource: string;
    solarCapacityKw?: number;
    expectedAnnualGenerationKwh?: number;
    recWeight: number;
    smpWonPerKwh?: number;
    recPriceWonPerRec?: number;
  };
  kakaoLocation?: KakaoLocationResult;
  kepcoApis: {
    commonMetroCodes?: ReturnType<typeof summarizeCommonCodes>;
    commonCityCodes?: ReturnType<typeof summarizeCommonCodes>;
    renewableContracts?: ReturnType<typeof summarizeRenewableContracts>;
    dispersedGeneration?: ReturnType<typeof summarizeDispersedGeneration>;
  };
  marketApis: {
    smp?: MarketApiSummary;
    rec?: MarketApiSummary;
  };
  revenueEstimate?: {
    annualSmpRevenueWon: number;
    annualRecRevenueWon: number;
    estimatedAnnualRevenueWon: number;
    assumptions: string[];
  };
  answerSummary: string;
  nextQuestions: string[];
  requiredApis: ReturnType<typeof getPublicApis>;
  apiReadiness: ReturnType<typeof getApiReadiness>;
  disclaimer: string;
}

interface MarketApiSummary {
  attempted: boolean;
  used: boolean;
  serviceKeyConfigured: boolean;
  endpoint?: string;
  message: string;
  representativeValue?: number;
  sampleCount?: number;
}

function currentYear(): number {
  return new Date().getFullYear();
}

function numberFrom(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? Number.parseFloat(match[1].replace(/,/g, '')) : undefined;
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function wonAmountFrom(text: string, patterns: RegExp[]): number | undefined {
  const normalized = text.replace(/,/g, '');
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const value = match?.[1] ? Number.parseFloat(match[1]) : undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }
    const unit = match?.[2] ?? '';
    if (unit.includes('만원')) {
      return value * 10000;
    }
    if (unit.includes('천원')) {
      return value * 1000;
    }
    return value;
  }
  return undefined;
}

function parseRenewableInput(input: RenewableSaleInput): RenewableSaleResult['parsed'] {
  const text = input.text ?? '';
  const genSrcCd = input.genSrcCd ?? (/풍력/.test(text) ? '3' : /소수력/.test(text) ? '2' : '1');
  return {
    locationText: input.locationText,
    year: input.year ?? currentYear() - 1,
    metroCd: input.metroCd,
    cityCd: input.cityCd,
    genSrcCd,
    generationSource: input.generationSource ?? (genSrcCd === '1' ? '태양광' : genSrcCd === '2' ? '소수력' : genSrcCd === '3' ? '풍력' : '신재생'),
    solarCapacityKw:
      input.solarCapacityKw ??
      numberFrom(text, [
        /(\d+(?:\.\d+)?)\s*kw\s*(?:태양광|발전|설비)?/i,
        /(\d+(?:\.\d+)?)\s*킬로와트/
      ]),
    expectedAnnualGenerationKwh:
      input.expectedAnnualGenerationKwh ??
      numberFrom(text.replace(/,/g, ''), [
        /연(?:간)?\s*(\d+(?:\.\d+)?)\s*kwh/i,
        /(\d+(?:\.\d+)?)\s*kwh\s*\/?\s*년/i
      ]),
    recWeight: input.recWeight ?? numberFrom(text, [/가중치\s*(\d+(?:\.\d+)?)/]) ?? 1,
    smpWonPerKwh:
      input.smpWonPerKwh ??
      wonAmountFrom(text, [
        /smp\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/i,
        /계통한계가격\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/
      ]),
    recPriceWonPerRec:
      input.recPriceWonPerRec ??
      wonAmountFrom(text, [
        /rec\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/i,
        /현물시장\s*(?:가격)?\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/
      ])
  };
}

function summarizeCommonCodes(result: Awaited<ReturnType<typeof fetchKepcoCommonCodes>>) {
  return {
    attempted: result.attempted,
    used: result.used,
    endpoint: result.endpoint,
    message: result.message,
    count: result.records.length,
    sample: result.records.slice(0, 10)
  };
}

function summarizeRenewableContracts(result: Awaited<ReturnType<typeof fetchKepcoRenewableContracts>>) {
  const totalCapacity = result.records.reduce((sum, row) => sum + (row.capacity ?? 0), 0);
  const totalCount = result.records.reduce((sum, row) => sum + (row.cnt ?? 0), 0);
  return {
    attempted: result.attempted,
    used: result.used,
    endpoint: result.endpoint,
    message: result.message,
    count: result.records.length,
    totalCount,
    totalCapacity,
    topCities: result.records
      .slice()
      .sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0))
      .slice(0, 5)
  };
}

function summarizeDispersedGeneration(result: Awaited<ReturnType<typeof fetchKepcoDispersedGeneration>>) {
  const bestFree = result.records
    .slice()
    .sort((a, b) => Math.max(b.vol1 ?? 0, b.vol2 ?? 0, b.vol3 ?? 0) - Math.max(a.vol1 ?? 0, a.vol2 ?? 0, a.vol3 ?? 0))
    .slice(0, 5);
  return {
    attempted: result.attempted,
    used: result.used,
    endpoint: result.endpoint,
    message: result.message,
    count: result.records.length,
    bestFree
  };
}

function normalizeRegionText(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/서울시/g, '서울특별시')
    .replace(/부산시/g, '부산광역시')
    .replace(/대구시/g, '대구광역시')
    .replace(/인천시/g, '인천광역시')
    .replace(/광주시/g, '광주광역시')
    .replace(/대전시/g, '대전광역시')
    .replace(/울산시/g, '울산광역시')
    .replace(/세종시/g, '세종특별자치시')
    .replace(/제주시/g, '제주특별자치도')
    .replace(/강원도/g, '강원특별자치도')
    .replace(/전북/g, '전북특별자치도')
    .replace(/전라북도/g, '전북특별자치도');
}

function regionAliases(codeNm: string): string[] {
  const compact = normalizeRegionText(codeNm);
  const aliases = new Set([compact]);
  aliases.add(compact.replace(/특별시|광역시|특별자치시|특별자치도|자치도|도|시|군|구/g, ''));
  if (compact === '서울특별시') aliases.add('서울');
  if (compact === '부산광역시') aliases.add('부산');
  if (compact === '대구광역시') aliases.add('대구');
  if (compact === '인천광역시') aliases.add('인천');
  if (compact === '광주광역시') aliases.add('광주');
  if (compact === '대전광역시') aliases.add('대전');
  if (compact === '울산광역시') aliases.add('울산');
  if (compact === '경기도') aliases.add('경기');
  if (compact === '충청북도') aliases.add('충북');
  if (compact === '충청남도') aliases.add('충남');
  if (compact === '전라남도') aliases.add('전남');
  if (compact === '경상북도') aliases.add('경북');
  if (compact === '경상남도') aliases.add('경남');
  return Array.from(aliases).filter(Boolean);
}

function matchCodeByText(codes: KepcoCommonCode[], text?: string): string | undefined {
  if (!text) {
    return undefined;
  }
  const compactText = normalizeRegionText(text);
  return codes
    .map((code) => {
      const score = regionAliases(code.codeNm).reduce((max, alias) => {
        if (!alias) return max;
        if (compactText === alias) return Math.max(max, 100);
        if (compactText.includes(alias)) return Math.max(max, alias.length);
        return max;
      }, 0);
      return { code, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.code.code;
}

function inferKnownMetroCd(text?: string): string | undefined {
  if (!text) return undefined;
  const compact = normalizeRegionText(text);
  const known: Array<[string, string[]]> = [
    ['11', ['서울특별시', '서울']],
    ['21', ['부산광역시', '부산']],
    ['22', ['대구광역시', '대구']],
    ['23', ['인천광역시', '인천']],
    ['24', ['광주광역시', '광주']],
    ['25', ['대전광역시', '대전']],
    ['26', ['울산광역시', '울산']],
    ['31', ['경기도', '경기']],
    ['32', ['강원특별자치도', '강원']],
    ['33', ['충청북도', '충북']],
    ['34', ['충청남도', '충남']],
    ['35', ['전북특별자치도', '전북']],
    ['36', ['전라남도', '전남']],
    ['37', ['경상북도', '경북']],
    ['38', ['경상남도', '경남']],
    ['39', ['제주특별자치도', '제주']]
  ];
  return known.find(([, aliases]) => aliases.some((alias) => compact.includes(normalizeRegionText(alias))))?.[0];
}

async function fetchMarketValue(input: {
  endpointEnv: string;
  serviceKeyEnv: string;
  fallbackServiceKeyEnv?: string;
  label: string;
}): Promise<MarketApiSummary> {
  const endpoint = process.env[input.endpointEnv];
  const key = firstConfiguredEnv([input.serviceKeyEnv, input.fallbackServiceKeyEnv ?? 'DATA_GO_KR_SERVICE_KEY']).value;
  if (!endpoint) {
    return {
      attempted: false,
      used: false,
      serviceKeyConfigured: Boolean(key),
      message: `${input.endpointEnv}가 설정되어 있지 않아 ${input.label} API를 호출하지 않았습니다.`
    };
  }
  if (!key) {
    return {
      attempted: false,
      used: false,
      serviceKeyConfigured: false,
      endpoint,
      message: `${input.serviceKeyEnv} 또는 DATA_GO_KR_SERVICE_KEY가 없어 ${input.label} API를 호출하지 않았습니다.`
    };
  }

  const params = new URLSearchParams({ serviceKey: key, ServiceKey: key, pageNo: '1', numOfRows: '30', dataType: 'JSON' });
  const url = endpoint.includes('?') ? `${endpoint}&${params.toString()}` : `${endpoint}?${params.toString()}`;
  const result = await fetchStructuredWithTimeout(url, {}, 15000);
  if (!result.ok) {
    return {
      attempted: true,
      used: false,
      serviceKeyConfigured: true,
      endpoint,
      message: `${input.label} API 호출 실패: ${result.message}`
    };
  }

  const body = result.data as Record<string, unknown> | undefined;
  const response = body?.response as Record<string, unknown> | undefined;
  const itemsContainer = (response?.body as Record<string, unknown> | undefined)?.items as Record<string, unknown> | undefined;
  const rows = ensureArray((itemsContainer?.item ?? body?.data ?? body?.items) as Record<string, unknown> | Record<string, unknown>[] | undefined);
  const numericValues = rows
    .flatMap((row) => Object.values(row))
    .map(parseFiniteNumber)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const representativeValue = numericValues[0];
  return {
    attempted: true,
    used: typeof representativeValue === 'number',
    serviceKeyConfigured: true,
    endpoint,
    message:
      typeof representativeValue === 'number'
        ? `${input.label} API에서 대표 숫자값을 추출했습니다. 정확한 필드 매핑은 서비스별 응답 스키마에 맞춰 보정해야 합니다.`
        : `${input.label} API 응답에서 수익 계산에 쓸 숫자 필드를 찾지 못했습니다.`,
    representativeValue,
    sampleCount: rows.length
  };
}

function buildRevenueEstimate(parsed: RenewableSaleResult['parsed']): RenewableSaleResult['revenueEstimate'] | undefined {
  if (
    typeof parsed.expectedAnnualGenerationKwh !== 'number' ||
    typeof parsed.smpWonPerKwh !== 'number' ||
    typeof parsed.recPriceWonPerRec !== 'number'
  ) {
    return undefined;
  }
  const annualSmpRevenueWon = Math.round(parsed.expectedAnnualGenerationKwh * parsed.smpWonPerKwh);
  const annualRecRevenueWon = Math.round((parsed.expectedAnnualGenerationKwh / 1000) * parsed.recWeight * parsed.recPriceWonPerRec);
  return {
    annualSmpRevenueWon,
    annualRecRevenueWon,
    estimatedAnnualRevenueWon: annualSmpRevenueWon + annualRecRevenueWon,
    assumptions: [
      'SMP 수익 = 연 발전량(kWh) x SMP(원/kWh)',
      'REC 수익 = 연 발전량(MWh) x REC 가중치 x REC 가격(원/REC)',
      '세금, 수수료, 출력제어, 유지보수비, 계약조건은 반영하지 않은 MVP 추정'
    ]
  };
}

function buildRenewableSummary(input: {
  parsed: RenewableSaleResult['parsed'];
  revenueEstimate?: RenewableSaleResult['revenueEstimate'];
  renewableContracts?: ReturnType<typeof summarizeRenewableContracts>;
  dispersedGeneration?: ReturnType<typeof summarizeDispersedGeneration>;
}): string {
  const parts: string[] = [];
  if (input.revenueEstimate) {
    parts.push(
      `${input.parsed.generationSource} 연 발전량 ${input.parsed.expectedAnnualGenerationKwh}kWh 기준 예상 연 매출은 약 ${input.revenueEstimate.estimatedAnnualRevenueWon.toLocaleString('ko-KR')}원입니다.`
    );
  } else {
    parts.push('신재생 판매 수익을 계산하려면 위치/설비용량 외에 예상 연 발전량, SMP, REC 가격 또는 KPX API endpoint 매핑이 필요합니다.');
  }
  if (input.dispersedGeneration?.used) {
    parts.push(`분산전원 연계정보는 ${input.dispersedGeneration.count}건 조회됐습니다.`);
  } else if (input.dispersedGeneration?.attempted) {
    parts.push(`분산전원 연계정보 조회는 실패했습니다: ${input.dispersedGeneration.message}`);
  }
  if (input.renewableContracts?.used) {
    parts.push(`신재생 계약현황은 ${input.renewableContracts.count}건 조회됐습니다.`);
  } else if (input.renewableContracts?.attempted) {
    parts.push(`신재생 계약현황 API는 응답하지 않았습니다: ${input.renewableContracts.message}`);
  }
  return parts.join('\n');
}

export async function analyzeRenewableEnergySale(input: RenewableSaleInput): Promise<RenewableSaleResult> {
  const parsed = parseRenewableInput(input);
  const requiredApis = getPublicApis({ feature: 'renewable_sale' });
  const apiReadiness = getApiReadiness({ feature: 'renewable_sale' });
  const locationText = input.locationText ?? input.text;
  const shouldUseLiveApi = input.useLiveApi !== false;
  const kakaoLocation = shouldUseLiveApi ? await resolveKakaoLocation(locationText) : undefined;
  const resolvedLocationText =
    [locationText, kakaoLocation?.location?.addressName, kakaoLocation?.location?.roadAddressName].filter(Boolean).join(' ') || undefined;

  let metroCodes: Awaited<ReturnType<typeof fetchKepcoCommonCodes>> | undefined;
  let cityCodes: Awaited<ReturnType<typeof fetchKepcoCommonCodes>> | undefined;
  let metroCd = parsed.metroCd;
  let cityCd = parsed.cityCd;
  if (shouldUseLiveApi) {
    metroCodes = await fetchKepcoCommonCodes('metroCd');
    metroCd = metroCd ?? matchCodeByText(metroCodes.records, resolvedLocationText) ?? inferKnownMetroCd(resolvedLocationText);
    cityCodes = await fetchKepcoCommonCodes('cityCd');
    cityCd = cityCd ?? matchCodeByText(cityCodes.records.filter((code) => !metroCd || code.uppoCd === metroCd), resolvedLocationText);
  }

  const renewableContracts =
    shouldUseLiveApi && metroCd
      ? await fetchKepcoRenewableContracts({ year: parsed.year, metroCd, genSrcCd: parsed.genSrcCd })
      : undefined;
  const hasDispersedDetail = Boolean(input.substCd || input.addrLidong || input.addrLi || input.addrJibun);
  const dispersedGeneration =
    shouldUseLiveApi && hasDispersedDetail
      ? await fetchKepcoDispersedGeneration({
          metroCd,
          cityCd,
          addrLidong: input.addrLidong,
          addrLi: input.addrLi,
          addrJibun: input.addrJibun
        })
      : undefined;

  const smp =
    typeof parsed.smpWonPerKwh === 'number'
      ? undefined
      : await fetchMarketValue({
          endpointEnv: 'KPX_SMP_DEMAND_ENDPOINT',
          serviceKeyEnv: 'KPX_SMP_DEMAND_SERVICE_KEY',
          label: 'KPX SMP/수요예측'
        });
  const rec =
    typeof parsed.recPriceWonPerRec === 'number'
      ? undefined
      : await fetchMarketValue({
          endpointEnv: 'KPX_REC_SPOT_ENDPOINT',
          serviceKeyEnv: 'KPX_REC_SPOT_SERVICE_KEY',
          label: 'KPX REC 현물시장'
        });

  const enrichedParsed = {
    ...parsed,
    metroCd,
    cityCd,
    smpWonPerKwh: parsed.smpWonPerKwh ?? smp?.representativeValue,
    recPriceWonPerRec: parsed.recPriceWonPerRec ?? rec?.representativeValue
  };
  const revenueEstimate = buildRevenueEstimate(enrichedParsed);
  const liveUsed = Boolean(
    kakaoLocation?.used ||
      metroCodes?.used ||
      cityCodes?.used ||
      renewableContracts?.used ||
      dispersedGeneration?.used ||
      smp?.used ||
      rec?.used
  );
  const dataMode: ApiDataMode = liveUsed ? 'live_public_api' : revenueEstimate ? 'user_provided' : 'unavailable';

  const renewableSummary = renewableContracts ? summarizeRenewableContracts(renewableContracts) : undefined;
  const dispersedSummary = dispersedGeneration ? summarizeDispersedGeneration(dispersedGeneration) : undefined;

  return {
    dataMode,
    parsed: enrichedParsed,
    kakaoLocation,
    kepcoApis: {
      commonMetroCodes: metroCodes ? summarizeCommonCodes(metroCodes) : undefined,
      commonCityCodes: cityCodes ? summarizeCommonCodes(cityCodes) : undefined,
      renewableContracts: renewableSummary,
      dispersedGeneration: dispersedSummary
    },
    marketApis: { smp, rec },
    revenueEstimate,
    answerSummary: buildRenewableSummary({
      parsed: enrichedParsed,
      revenueEstimate,
      renewableContracts: renewableSummary,
      dispersedGeneration: dispersedSummary
    }),
    nextQuestions: [
      '계통연계 여유용량을 보려면 설치 예정 주소가 시도/시군구/동/리/지번 또는 변전소 코드까지 있는지',
      '발전원과 설비용량이 얼마인지',
      '전부 판매인지, 자가소비 후 잉여 판매인지',
      '예상 연 발전량 또는 발전량 산정 기준이 있는지',
      'REC 가중치와 적용 가능한 계약/거래 방식이 무엇인지'
    ],
    requiredApis,
    apiReadiness,
    disclaimer:
      '이 결과는 한전 전력데이터개방포털/KPX 공개 API와 사용자 입력값 기반의 사전 검토입니다. 실제 PPA, 전력시장 참여, REC 발급/거래, 계통연계 가능 여부는 한전/전력거래소/한국에너지공단 절차 확인이 필요합니다.'
  };
}
