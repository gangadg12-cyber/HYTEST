import {
  fetchKepcoCommonCodes,
  fetchKepcoDispersedGeneration,
  fetchKepcoRenewableContracts,
  type KepcoCommonCode,
  type KepcoDispersedGeneration,
  type KepcoRenewableContract
} from './kepcoBigdata.js';
import { resolveKakaoLocation, type KakaoLocationResult } from './kakaoLocal.js';
import { getApiReadiness, getConfiguredServiceKey, getPublicApis, type ApiDataMode } from './publicApis.js';
import { ensureArray, fetchStructuredWithTimeout, parseFiniteNumber } from './publicApiClient.js';

type RenewableRequestType = 'revenue' | 'contract_status' | 'grid_interconnection' | 'concept' | 'general';
type GenerationPeriod = 'daily' | 'monthly' | 'annual';
type RevenuePeriod = 'monthly' | 'annual';

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
    requestType: RenewableRequestType;
    solarCapacityKw?: number;
    expectedAnnualGenerationKwh?: number;
    generationInputKwh?: number;
    generationInputPeriod?: GenerationPeriod;
    requestedRevenuePeriod?: RevenuePeriod;
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
    monthlySmpRevenueWon: number;
    monthlyRecRevenueWon: number;
    estimatedMonthlyRevenueWon: number;
    assumptions: string[];
  };
  answerSummary: string;
  userFacingSummary: string[];
  clarifyingQuestions: string[];
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

const MARKET_API_ENDPOINTS: Record<string, string> = {
  KPX_SMP_DEMAND_ENDPOINT: 'https://apis.data.go.kr/B552115/SmpWithForecastDemand/getSmpWithForecastDemand',
  KPX_REC_SPOT_ENDPOINT: 'https://apis.data.go.kr/B552115/RecMarketInfo2/getRecMarketInfo2'
};

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

function scaledNumberFrom(text: string, patterns: RegExp[]): number | undefined {
  const normalized = text.replace(/,/g, '');
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const value = match?.[1] ? Number.parseFloat(match[1]) : undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue;
    }
    const unit = match?.[2] ?? '';
    if (unit.includes('억')) {
      return value * 100000000;
    }
    if (unit.includes('만')) {
      return value * 10000;
    }
    if (unit.includes('천')) {
      return value * 1000;
    }
    return value;
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

function normalizeEnergyToKwh(value: number, unit?: string): number {
  return /mwh|메가와트시/i.test(unit ?? '') ? value * 1000 : value;
}

function annualizeGenerationKwh(value: number, period: GenerationPeriod): number {
  if (period === 'daily') {
    return value * 365;
  }
  if (period === 'monthly') {
    return value * 12;
  }
  return value;
}

function parseGenerationWithPeriod(text: string): {
  annualKwh: number;
  inputKwh: number;
  period: GenerationPeriod;
} | undefined {
  const normalized = text.replace(/,/g, '');
  const patterns: Array<{ period: GenerationPeriod; regexes: RegExp[] }> = [
    {
      period: 'daily',
      regexes: [
        /(?:하루|1일|일\s*평균|일|매일)\s*(\d+(?:\.\d+)?)\s*(kwh|kw\s*h|mwh|mw\s*h|킬로와트시|키로와트시|메가와트시)/i,
        /(\d+(?:\.\d+)?)\s*(kwh|kw\s*h|mwh|mw\s*h|킬로와트시|키로와트시|메가와트시)\s*(?:씩)?\s*(?:하루|1일|일\s*평균|일|매일|\/\s*일)/i
      ]
    },
    {
      period: 'monthly',
      regexes: [
        /(?:월|매월|한달|한\s*달)\s*(\d+(?:\.\d+)?)\s*(kwh|kw\s*h|mwh|mw\s*h|킬로와트시|키로와트시|메가와트시)/i,
        /(\d+(?:\.\d+)?)\s*(kwh|kw\s*h|mwh|mw\s*h|킬로와트시|키로와트시|메가와트시)\s*(?:씩)?\s*(?:월|매월|한달|한\s*달|\/\s*월)/i
      ]
    },
    {
      period: 'annual',
      regexes: [
        /(?:연|연간|1년|년)\s*(\d+(?:\.\d+)?)\s*(만|천|억)?\s*(kwh|kw\s*h|mwh|mw\s*h|킬로와트시|키로와트시|메가와트시)/i,
        /(\d+(?:\.\d+)?)\s*(만|천|억)?\s*(kwh|kw\s*h|mwh|mw\s*h|킬로와트시|키로와트시|메가와트시)\s*\/?\s*(?:년|연간|1년)/i
      ]
    }
  ];

  for (const { period, regexes } of patterns) {
    for (const regex of regexes) {
      const match = normalized.match(regex);
      if (!match) {
        continue;
      }
      const rawValue = Number.parseFloat(match[1]);
      if (!Number.isFinite(rawValue)) {
        continue;
      }
      const scale = match[2] === '억' ? 100000000 : match[2] === '만' ? 10000 : match[2] === '천' ? 1000 : 1;
      const unit = match[3] ?? match[2];
      const inputKwh = normalizeEnergyToKwh(rawValue * scale, unit);
      return {
        inputKwh,
        period,
        annualKwh: annualizeGenerationKwh(inputKwh, period)
      };
    }
  }
  return undefined;
}

function inferRenewableRequestType(text: string): RenewableRequestType {
  if (/계통|연계|여유용량|분산전원|변전소|DL|배전선로/i.test(text)) {
    return 'grid_interconnection';
  }
  if (/계약현황|계약된|발전기\s*개수|설비가\s*얼마|설비가\s*얼마나|발전용량|공식\s*데이터|현황\s*조회/i.test(text)) {
    return 'contract_status';
  }
  if (isRenewableConceptOnlyQuestion(text)) {
    return 'concept';
  }
  if (/수익|매출|얼마|계산|돈|판매|smp|rec|ppa|팔면|팔려면/i.test(text)) {
    return 'revenue';
  }
  return 'general';
}

function inferRequestedRevenuePeriod(text: string): RevenuePeriod {
  return /월\s*수익|월\s*매출|한\s*달\s*수익|한달\s*수익|월\s*얼마/i.test(text) ? 'monthly' : 'annual';
}

function parseRenewableInput(input: RenewableSaleInput): RenewableSaleResult['parsed'] {
  const text = input.text ?? '';
  const genSrcCd = input.genSrcCd ?? (/풍력/.test(text) ? '3' : /소수력/.test(text) ? '2' : '1');
  const requestType = inferRenewableRequestType(text);
  const generationWithPeriod = parseGenerationWithPeriod(text);
  const expectedAnnualGenerationKwh =
    generationWithPeriod?.annualKwh ??
    input.expectedAnnualGenerationKwh ??
    scaledNumberFrom(text, [
      /연(?:간)?\s*(\d+(?:\.\d+)?)\s*(만|천|억)?\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)/i,
      /(\d+(?:\.\d+)?)\s*(만|천|억)?\s*(?:kwh|kw\s*h|킬로와트시|키로와트시)\s*\/?\s*(?:년|연간|1년)/i
    ]);
  return {
    locationText: input.locationText,
    year: input.year ?? currentYear() - 1,
    metroCd: input.metroCd,
    cityCd: input.cityCd,
    genSrcCd,
    generationSource: input.generationSource ?? (genSrcCd === '1' ? '태양광' : genSrcCd === '2' ? '소수력' : genSrcCd === '3' ? '풍력' : '신재생'),
    requestType,
    solarCapacityKw:
      input.solarCapacityKw ??
      numberFrom(text, [
        /(\d+(?:\.\d+)?)\s*kw(?!\s*h|h)\s*(?:태양광|발전|설비)?/i,
        /(\d+(?:\.\d+)?)\s*킬로와트/
      ]),
    expectedAnnualGenerationKwh,
    generationInputKwh: generationWithPeriod?.inputKwh,
    generationInputPeriod: generationWithPeriod?.period,
    requestedRevenuePeriod: inferRequestedRevenuePeriod(text),
    recWeight: input.recWeight ?? numberFrom(text, [/가중치\s*(\d+(?:\.\d+)?)/]) ?? 1,
    smpWonPerKwh:
      input.smpWonPerKwh ??
      wonAmountFrom(text, [
        /smp\s*(?:가격|단가|시세|가|는|이)?\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/i,
        /계통한계가격\s*(?:가격|단가|시세|가|는|이)?\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/,
        /(\d+(?:\.\d+)?)\s*(원|천원|만원)?\s*(?:\/?\s*kwh|원\s*\/?\s*kwh)?\s*(?:smp|계통한계가격)/i
      ]),
    recPriceWonPerRec:
      input.recPriceWonPerRec ??
      wonAmountFrom(text, [
        /rec\s*(?:현물|가격|단가|시세|가|는|이)?\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/i,
        /(?:rec\s*)?현물시장\s*(?:가격|단가|시세|가|는|이)?\s*(\d+(?:\.\d+)?)\s*(원|천원|만원)?/i,
        /(\d+(?:\.\d+)?)\s*(원|천원|만원)?\s*(?:\/?\s*rec)?\s*(?:rec|현물시장)/i
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
  endpointName: string;
  serviceKeyName: string;
  label: string;
  valueFieldHints: string[];
}): Promise<MarketApiSummary> {
  const endpoint = MARKET_API_ENDPOINTS[input.endpointName];
  const key = getConfiguredServiceKey([input.serviceKeyName]);
  if (!endpoint) {
    return {
      attempted: false,
      used: false,
      serviceKeyConfigured: Boolean(key),
      message: `서버 소스코드에 ${input.endpointName} endpoint가 등록되어 있지 않아 ${input.label} API를 호출하지 않았습니다.`
    };
  }
  if (!key) {
    return {
      attempted: false,
      used: false,
      serviceKeyConfigured: false,
      endpoint,
      message: `서버 소스코드에 ${input.serviceKeyName}가 등록되어 있지 않아 ${input.label} API를 호출하지 않았습니다.`
    };
  }

  const params = new URLSearchParams({ serviceKey: key, ServiceKey: key, pageNo: '1', numOfRows: '30', dataType: 'json' });
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
  const representativeValue = findRepresentativeMarketValue(rows, input.valueFieldHints);
  return {
    attempted: true,
    used: typeof representativeValue === 'number',
    serviceKeyConfigured: true,
    endpoint,
    message:
      typeof representativeValue === 'number'
        ? `${input.label} API에서 가격 성격의 대표 필드를 추출했습니다.`
        : `${input.label} API 응답에서 수익 계산에 쓸 숫자 필드를 찾지 못했습니다.`,
    representativeValue,
    sampleCount: rows.length
  };
}

function findRepresentativeMarketValue(rows: Record<string, unknown>[], valueFieldHints: string[]): number | undefined {
  const normalizedHints = valueFieldHints.map((hint) => hint.toLowerCase());
  for (const row of rows) {
    const hinted = Object.entries(row)
      .filter(([key]) => {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
        return normalizedHints.some((hint) => normalizedKey.includes(hint));
      })
      .map(([, value]) => parseFiniteNumber(value))
      .filter((value): value is number => typeof value === 'number' && value > 0);
    if (hinted.length > 0) {
      return hinted[0];
    }
  }
  return undefined;
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
  const monthlySmpRevenueWon = Math.round(annualSmpRevenueWon / 12);
  const monthlyRecRevenueWon = Math.round(annualRecRevenueWon / 12);
  return {
    annualSmpRevenueWon,
    annualRecRevenueWon,
    estimatedAnnualRevenueWon: annualSmpRevenueWon + annualRecRevenueWon,
    monthlySmpRevenueWon,
    monthlyRecRevenueWon,
    estimatedMonthlyRevenueWon: monthlySmpRevenueWon + monthlyRecRevenueWon,
    assumptions: [
      'SMP 수익 = 연 발전량(kWh) x SMP(원/kWh)',
      'REC 수익 = 연 발전량(MWh) x REC 가중치 x REC 가격(원/REC)',
      '세금, 수수료, 출력제어, 유지보수비, 계약조건은 반영하지 않은 MVP 추정'
    ]
  };
}

function buildRenewableConceptLines(text?: string): string[] {
  if (!text) {
    return [];
  }
  const lines: string[] = [];
  if (/rec/i.test(text)) {
    lines.push('REC는 신재생에너지 공급인증서로, 발전량의 환경가치를 인증해 별도로 거래하는 수익 요소입니다.');
  }
  if (/smp/i.test(text)) {
    lines.push('SMP는 계통한계가격으로, 전력시장에 판매되는 전력량(kWh)에 적용되는 전력 판매 단가입니다.');
  }
  if (/ppa/i.test(text)) {
    lines.push('PPA는 발전사업자와 전력 구매자가 전력 구매 조건을 계약으로 정하는 방식입니다.');
  }
  if (/상계거래|요금상계/.test(text)) {
    lines.push('상계거래는 생산 전력을 자가소비 또는 사용요금 차감 구조로 처리하는 방식이라, 전력 판매 계약과 구분됩니다.');
  }
  if (/분산전원|계통|연계|여유용량/.test(text)) {
    lines.push('분산전원 연계 검토는 설치 예정 주소를 시도, 시군구, 동/면, 리, 지번 또는 변전소 코드 수준으로 좁혀야 정확도가 올라갑니다.');
  }
  return Array.from(new Set(lines)).slice(0, 5);
}

function isRenewableConceptOnlyQuestion(text?: string): boolean {
  if (!text) {
    return false;
  }
  const asksConcept = /(?:뭐야|무엇|뜻|의미|설명|차이|비교|역할|개념)/.test(text);
  const asksCalculation = /(?:매출|얼마|계산|조회|계통|연계|여유|계약현황|판매\s*가능|\d+(?:\.\d+)?\s*(?:kwh|kw\s*h|mwh|mw\s*h|kw))/i.test(text);
  return asksConcept && !asksCalculation;
}

function requiresRenewableLocation(text?: string): boolean {
  if (!text) {
    return false;
  }
  return /(?:계통|연계|여유용량|분산전원|계약현황|판매\s*가능|설치\s*예정|주소|지역|어디)/.test(text);
}

function buildRenewableClarifyingQuestions(input: {
  parsed: RenewableSaleResult['parsed'];
  hasRevenueEstimate: boolean;
  conceptOnly: boolean;
  requiresLocation: boolean;
}): string[] {
  const { parsed, hasRevenueEstimate, conceptOnly, requiresLocation } = input;
  if (conceptOnly) {
    return [];
  }
  const questions: string[] = [];
  if (requiresLocation && !parsed.locationText && !parsed.metroCd) {
    questions.push('설치 예정 위치 또는 시도/시군구 정보를 알려주세요.');
  }
  if (parsed.requestType === 'grid_interconnection') {
    if (!parsed.locationText && !parsed.metroCd) {
      questions.push('계통연계 여유 확인은 설치 예정 주소를 시도/시군구/동·면/리/지번 또는 변전소 코드 수준으로 알려주세요.');
    } else {
      questions.push('가능하면 동·면, 리, 지번 또는 변전소 코드를 추가로 알려주세요.');
    }
    return Array.from(new Set(questions));
  }
  if (parsed.requestType === 'contract_status') {
    if (!parsed.locationText && !parsed.metroCd) {
      questions.push('계약현황을 볼 시도/시군구와 조회 연도를 알려주세요.');
    }
    return Array.from(new Set(questions));
  }
  if (!hasRevenueEstimate && parsed.requestType !== 'general') {
    if (typeof parsed.expectedAnnualGenerationKwh !== 'number') {
      questions.push('예상 연 발전량(kWh)을 알려주세요.');
    }
    if (typeof parsed.smpWonPerKwh !== 'number') {
      questions.push('SMP 가격(원/kWh)을 알려주거나 KPX API 조회가 가능해야 합니다.');
    }
    if (typeof parsed.recPriceWonPerRec !== 'number') {
      questions.push('REC 가격(원/REC)을 알려주거나 KPX API 조회가 가능해야 합니다.');
    }
  }
  return questions;
}

function buildRenewableSummary(input: {
  parsed: RenewableSaleResult['parsed'];
  conceptLines: string[];
  revenueEstimate?: RenewableSaleResult['revenueEstimate'];
  renewableContracts?: ReturnType<typeof summarizeRenewableContracts>;
  dispersedGeneration?: ReturnType<typeof summarizeDispersedGeneration>;
}): string {
  const parts: string[] = [];
  if (input.revenueEstimate) {
    const generationNote =
      input.parsed.generationInputKwh && input.parsed.generationInputPeriod
        ? `입력 발전량 ${input.parsed.generationInputKwh}kWh/${input.parsed.generationInputPeriod}을 연 ${input.parsed.expectedAnnualGenerationKwh}kWh로 환산했습니다.`
        : `${input.parsed.generationSource} 연 발전량 ${input.parsed.expectedAnnualGenerationKwh}kWh 기준입니다.`;
    parts.push(generationNote);
    parts.push(
      input.parsed.requestedRevenuePeriod === 'monthly'
        ? `예상 월 매출은 약 ${input.revenueEstimate.estimatedMonthlyRevenueWon.toLocaleString('ko-KR')}원입니다. 연 환산 매출은 약 ${input.revenueEstimate.estimatedAnnualRevenueWon.toLocaleString('ko-KR')}원입니다.`
        : `예상 연 매출은 약 ${input.revenueEstimate.estimatedAnnualRevenueWon.toLocaleString('ko-KR')}원입니다.`
    );
  } else {
    parts.push(...input.conceptLines);
    if (input.parsed.requestType === 'contract_status') {
      parts.push('신재생 계약현황은 지역과 연도를 기준으로 발전원별 설비 개수와 용량을 조회하는 기능입니다.');
    } else if (input.parsed.requestType === 'grid_interconnection') {
      parts.push('계통연계 여유 확인은 설치 예정 주소를 동·면/리/지번 또는 변전소 코드 수준으로 좁혀야 합니다.');
    } else if (input.parsed.requestType === 'revenue') {
      parts.push('신재생 판매 수익을 계산하려면 예상 연 발전량, SMP, REC 가격 또는 KPX API endpoint 매핑이 필요합니다.');
    }
  }
  if (input.revenueEstimate) {
    parts.push(...input.conceptLines);
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

function buildRenewableUserFacingSummary(input: {
  parsed: RenewableSaleResult['parsed'];
  conceptLines: string[];
  revenueEstimate?: RenewableSaleResult['revenueEstimate'];
  renewableContracts?: ReturnType<typeof summarizeRenewableContracts>;
  dispersedGeneration?: ReturnType<typeof summarizeDispersedGeneration>;
  clarifyingQuestions: string[];
}): string[] {
  const summary: string[] = [];
  if (input.revenueEstimate) {
    if (input.parsed.requestedRevenuePeriod === 'monthly') {
      summary.push(`예상 월 매출: 약 ${input.revenueEstimate.estimatedMonthlyRevenueWon.toLocaleString('ko-KR')}원`);
      summary.push(
        `월 환산 SMP ${input.revenueEstimate.monthlySmpRevenueWon.toLocaleString('ko-KR')}원 + REC ${input.revenueEstimate.monthlyRecRevenueWon.toLocaleString('ko-KR')}원 기준`
      );
    } else {
      summary.push(`예상 연 매출: 약 ${input.revenueEstimate.estimatedAnnualRevenueWon.toLocaleString('ko-KR')}원`);
      summary.push(
        `SMP ${input.revenueEstimate.annualSmpRevenueWon.toLocaleString('ko-KR')}원 + REC ${input.revenueEstimate.annualRecRevenueWon.toLocaleString('ko-KR')}원 기준`
      );
    }
  } else {
    summary.push(...input.conceptLines.slice(0, 2));
    if (input.parsed.requestType === 'contract_status') {
      summary.push('계약현황 조회에는 지역과 조회 연도가 필요합니다.');
    } else if (input.parsed.requestType === 'grid_interconnection') {
      summary.push('계통연계 조회에는 상세 주소 또는 변전소 코드가 필요합니다.');
    } else if (input.parsed.requestType === 'revenue') {
      summary.push('신재생 판매 수익 계산에는 연 발전량, SMP, REC 가격이 필요합니다.');
    }
  }
  if (input.revenueEstimate) {
    summary.push(...input.conceptLines.slice(0, 1));
  }
  if (input.dispersedGeneration?.used) {
    summary.push(`분산전원 연계정보: ${input.dispersedGeneration.count}건 조회`);
  }
  if (input.renewableContracts?.used) {
    summary.push(`신재생 계약현황: ${input.renewableContracts.count}건 조회`);
  }
  if (input.clarifyingQuestions.length > 0) {
    summary.push(`추가로 확인할 내용: ${input.clarifyingQuestions.slice(0, 2).join(' / ')}`);
  }
  return summary.slice(0, 5);
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

  const shouldFetchRenewableContracts = parsed.requestType !== 'grid_interconnection';
  const shouldFetchMarket = parsed.requestType === 'revenue';
  const renewableContracts =
    shouldUseLiveApi && shouldFetchRenewableContracts && metroCd
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
    !shouldUseLiveApi || !shouldFetchMarket || typeof parsed.smpWonPerKwh === 'number'
      ? undefined
      : await fetchMarketValue({
          endpointName: 'KPX_SMP_DEMAND_ENDPOINT',
          serviceKeyName: 'KPX_SMP_DEMAND_SERVICE_KEY',
          label: 'KPX SMP/수요예측',
          valueFieldHints: ['smp', '육지smp', '제주smp', 'landsmp', 'jejusmp']
        });
  const rec =
    !shouldUseLiveApi || !shouldFetchMarket || typeof parsed.recPriceWonPerRec === 'number'
      ? undefined
      : await fetchMarketValue({
          endpointName: 'KPX_REC_SPOT_ENDPOINT',
          serviceKeyName: 'KPX_REC_SPOT_SERVICE_KEY',
          label: 'KPX REC 현물시장',
          valueFieldHints: ['avg', '평균', '평균가', 'price', 'prc', '종가', 'closing']
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
  const renewableSummary = renewableContracts ? summarizeRenewableContracts(renewableContracts) : undefined;
  const dispersedSummary = dispersedGeneration ? summarizeDispersedGeneration(dispersedGeneration) : undefined;
  const conceptLines = buildRenewableConceptLines(input.text);
  const conceptOnly = isRenewableConceptOnlyQuestion(input.text);
  const dataMode: ApiDataMode = liveUsed ? 'live_public_api' : revenueEstimate || conceptOnly ? 'user_provided' : 'unavailable';
  const clarifyingQuestions = buildRenewableClarifyingQuestions({
    parsed: enrichedParsed,
    hasRevenueEstimate: Boolean(revenueEstimate),
    conceptOnly,
    requiresLocation: requiresRenewableLocation(input.text)
  });

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
      conceptLines,
      revenueEstimate,
      renewableContracts: renewableSummary,
      dispersedGeneration: dispersedSummary
    }),
    userFacingSummary: buildRenewableUserFacingSummary({
      parsed: enrichedParsed,
      conceptLines,
      revenueEstimate,
      renewableContracts: renewableSummary,
      dispersedGeneration: dispersedSummary,
      clarifyingQuestions
    }),
    clarifyingQuestions,
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
