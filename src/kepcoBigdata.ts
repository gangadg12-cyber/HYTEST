import { ensureArray, fetchStructuredWithTimeout, firstConfiguredCredential, parseFiniteNumber } from './publicApiClient.js';

export interface KepcoApiResult<T> {
  attempted: boolean;
  used: boolean;
  serviceKeyConfigured: boolean;
  endpoint: string;
  message: string;
  records: T[];
}

export interface KepcoCommonCode {
  uppoCd?: string;
  uppoCdNm?: string;
  codeTy?: string;
  code: string;
  codeNm: string;
}

export interface KepcoRenewableContract {
  genSrc?: string;
  metro?: string;
  city?: string;
  cnt?: number;
  capacity?: number;
  areaCnt?: number;
  areaCapacity?: number;
}

export interface KepcoDispersedGeneration {
  substCd?: string;
  substNm?: string;
  jsSubstPwr?: number;
  substPwr?: number;
  mtrNo?: string;
  jsMtrPwr?: number;
  mtrPwr?: number;
  dlCd?: string;
  dlNm?: string;
  jsDlPwr?: number;
  dlPwr?: number;
  vol1?: number;
  vol2?: number;
  vol3?: number;
}

export interface KepcoHouseAverageUsage {
  year?: string;
  month?: string;
  metro?: string;
  city?: string;
  houseCnt?: number;
  powerUsage?: number;
  bill?: number;
}

export interface KepcoResolvedRegionCodes {
  regionText?: string;
  metroCd?: string;
  metroName?: string;
  cityCd?: string;
  cityName?: string;
  attempted: boolean;
  used: boolean;
  message: string;
}

const KEPCO_BIGDATA_BASE_URL = 'https://bigdata.kepco.co.kr/openapi/v1';
const COMMON_CODE_CACHE_TTL_MS = 1000 * 60 * 30;
const commonCodeCache = new Map<string, { fetchedAt: number; result: KepcoApiResult<KepcoCommonCode> }>();

function getKepcoBigdataKey(): string | undefined {
  return firstConfiguredCredential(['KEPCO_BIGDATA_API_KEY']).value;
}

function buildKepcoUrl(path: string, params: Record<string, string | number | undefined>): string {
  const key = getKepcoBigdataKey();
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(name, String(value));
    }
  }
  if (key) {
    search.set('apiKey', key);
  }
  search.set('returnType', 'json');
  return `${KEPCO_BIGDATA_BASE_URL}/${path}?${search.toString()}`;
}

function extractKepcoRows(data: unknown): Array<Record<string, unknown>> {
  const record = data as Record<string, unknown> | undefined;
  if (!record) {
    return [];
  }
  const rows = record.data ?? (record.response as Record<string, unknown> | undefined)?.body;
  return ensureArray(rows as Record<string, unknown> | Array<Record<string, unknown>> | undefined);
}

function unavailable<T>(endpoint: string, message: string): KepcoApiResult<T> {
  return {
    attempted: false,
    used: false,
    serviceKeyConfigured: false,
    endpoint,
    message,
    records: []
  };
}

async function callKepco<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  mapper: (row: Record<string, unknown>) => T | undefined
): Promise<KepcoApiResult<T>> {
  const endpoint = `${KEPCO_BIGDATA_BASE_URL}/${path}`;
  if (!getKepcoBigdataKey()) {
    return unavailable(endpoint, 'KEPCO_BIGDATA_API_KEY가 없어 한전 전력데이터개방포털 API를 호출하지 않았습니다.');
  }
  const url = buildKepcoUrl(path, params);
  const result = await fetchStructuredWithTimeout(url, {}, 15000);
  if (!result.ok) {
    return {
      attempted: true,
      used: false,
      serviceKeyConfigured: true,
      endpoint,
      message: `한전 전력데이터개방포털 API 호출 실패: ${result.message}`,
      records: []
    };
  }
  const records = extractKepcoRows(result.data).map(mapper).filter((row): row is T => Boolean(row));
  return {
    attempted: true,
    used: records.length > 0,
    serviceKeyConfigured: true,
    endpoint,
    message: records.length > 0 ? `한전 전력데이터개방포털 API에서 ${records.length}건을 조회했습니다.` : '한전 전력데이터개방포털 API 응답에 사용 가능한 data가 없습니다.',
    records
  };
}

function normalizeRegionName(value?: string): string {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[(){}\[\],.]/g, '');
}

function stripRegionSuffix(value: string): string {
  return value.replace(/(?:특별자치시|특별자치도|특별시|광역시|자치도|도|시|군|구)$/g, '');
}

function regionMatches(source: string | undefined, target: string | undefined): boolean {
  return regionMatchScore(source, target) > 0;
}

function regionMatchScore(source: string | undefined, target: string | undefined): number {
  const normalizedSource = normalizeRegionName(source);
  const normalizedTarget = normalizeRegionName(target);
  if (!normalizedSource || !normalizedTarget) {
    return 0;
  }
  if (normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)) {
    return normalizedTarget.length * 100 + (normalizedSource === normalizedTarget ? 10000 : 0);
  }
  const sourceCore = stripRegionSuffix(normalizedSource);
  const targetCore = stripRegionSuffix(normalizedTarget);
  if (
    targetCore.length >= 2 &&
    sourceCore.length >= 2 &&
    (normalizedSource.includes(targetCore) ||
      sourceCore.includes(targetCore) ||
      targetCore.includes(sourceCore))
  ) {
    return targetCore.length * 10;
  }
  return 0;
}

function bestRegionCodeMatch(codes: KepcoCommonCode[], source: string | undefined): KepcoCommonCode | undefined {
  return codes
    .map((record) => ({ record, score: regionMatchScore(source, record.codeNm) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.record.codeNm.length - a.record.codeNm.length)[0]?.record;
}

const METRO_CODE_NAMES: Record<string, string[]> = {
  '11': ['서울특별시', '서울'],
  '21': ['부산광역시', '부산'],
  '22': ['대구광역시', '대구'],
  '23': ['인천광역시', '인천'],
  '24': ['광주광역시', '광주'],
  '25': ['대전광역시', '대전'],
  '26': ['울산광역시', '울산'],
  '31': ['경기도', '경기'],
  '32': ['강원특별자치도', '강원도', '강원'],
  '33': ['충청북도', '충북'],
  '34': ['충청남도', '충남'],
  '35': ['전북특별자치도', '전라북도', '전북'],
  '36': ['전라남도', '전남'],
  '37': ['경상북도', '경북'],
  '38': ['경상남도', '경남'],
  '39': ['제주특별자치도', '제주']
};

function renewableRecordMatches(input: { metroCd?: string; cityCd?: string }, row: KepcoRenewableContract): boolean {
  if (input.metroCd) {
    const aliases = METRO_CODE_NAMES[input.metroCd] ?? [];
    const metro = normalizeRegionName(row.metro);
    if (!aliases.some((alias) => metro === normalizeRegionName(alias))) {
      return false;
    }
  }
  return true;
}

export async function fetchKepcoCommonCodes(codeTy: string): Promise<KepcoApiResult<KepcoCommonCode>> {
  const cached = commonCodeCache.get(codeTy);
  if (cached && Date.now() - cached.fetchedAt < COMMON_CODE_CACHE_TTL_MS) {
    return {
      ...cached.result,
      message: `${cached.result.message} 공통코드 캐시를 사용했습니다.`
    };
  }

  const result = await callKepco('commonCode.do', { codeTy }, (row) => {
    const code = String(row.code ?? '').trim();
    const codeNm = String(row.codeNm ?? '').trim();
    if (!code || !codeNm) {
      return undefined;
    }
    return {
      uppoCd: String(row.uppoCd ?? '').trim() || undefined,
      uppoCdNm: String(row.uppoCdNm ?? '').trim() || undefined,
      codeTy: String(row.codeTy ?? codeTy).trim(),
      code,
      codeNm
    };
  });
  if (result.used) {
    commonCodeCache.set(codeTy, { fetchedAt: Date.now(), result });
  }
  return result;
}

export async function resolveKepcoRegionCodes(input: {
  regionText?: string;
  metroCd?: string;
  cityCd?: string;
}): Promise<KepcoResolvedRegionCodes> {
  const regionText = input.regionText?.trim();
  if (input.metroCd) {
    return {
      regionText,
      metroCd: input.metroCd,
      cityCd: input.cityCd,
      attempted: false,
      used: true,
      message: '입력된 metroCd/cityCd를 사용했습니다.'
    };
  }

  if (!regionText) {
    return {
      attempted: false,
      used: false,
      message: '지역명이 없어 한전 공통코드 조회를 시도하지 않았습니다.'
    };
  }

  const metroCodes = await fetchKepcoCommonCodes('lglDngMetroCd');
  if (!metroCodes.used) {
    return {
      regionText,
      attempted: metroCodes.attempted,
      used: false,
      message: `법정동 시도 공통코드 조회 실패: ${metroCodes.message}`
    };
  }

  const metro = bestRegionCodeMatch(metroCodes.records, regionText);
  if (!metro) {
    return {
      regionText,
      attempted: true,
      used: false,
      message: '지역명에서 법정동 시도 공통코드를 찾지 못했습니다. 예: 서울 강남구, 경기 성남시.'
    };
  }

  const cityCodes = await fetchKepcoCommonCodes('lglDngCityCd');
  const city = bestRegionCodeMatch(
    cityCodes.records.filter((record) => record.uppoCd === metro.code),
    regionText
  );

  return {
    regionText,
    metroCd: metro.code,
    metroName: metro.codeNm,
    cityCd: input.cityCd ?? city?.code,
    cityName: city?.codeNm,
    attempted: true,
    used: true,
    message: city
      ? `${metro.codeNm} ${city.codeNm} 공통코드를 찾았습니다.`
      : `${metro.codeNm} 공통코드를 찾았습니다. 시군구는 특정하지 않고 시도 단위 평균을 조회합니다.`
  };
}

export async function fetchKepcoHouseAverageUsage(input: {
  year: string | number;
  month: string | number;
  metroCd: string;
  cityCd?: string;
}): Promise<KepcoApiResult<KepcoHouseAverageUsage>> {
  const month = String(input.month).padStart(2, '0');
  return callKepco(
    'powerUsage/houseAve.do',
    {
      year: input.year,
      month,
      metroCd: input.metroCd,
      cityCd: input.cityCd
    },
    (row) => ({
      year: String(row.year ?? input.year).trim() || undefined,
      month: String(row.month ?? month).trim() || undefined,
      metro: String(row.metro ?? '').trim() || undefined,
      city: String(row.city ?? '').trim() || undefined,
      houseCnt: parseFiniteNumber(row.houseCnt),
      powerUsage: parseFiniteNumber(row.powerUsage ?? row.powerUseage),
      bill: parseFiniteNumber(row.bill)
    })
  );
}

export async function fetchKepcoRenewableContracts(input: {
  year: string | number;
  metroCd?: string;
  genSrcCd?: string;
}): Promise<KepcoApiResult<KepcoRenewableContract>> {
  const result = await callKepco(
    'renewEnergy.do',
    {
      year: input.year,
      genSrcCd: input.genSrcCd
    },
    (row) => ({
      genSrc: String(row.genSrc ?? '').trim() || undefined,
      metro: String(row.metro ?? '').trim() || undefined,
      city: String(row.city ?? '').trim() || undefined,
      cnt: parseFiniteNumber(row.cnt),
      capacity: parseFiniteNumber(row.capacity),
      areaCnt: parseFiniteNumber(row.areaCnt),
      areaCapacity: parseFiniteNumber(row.areaCapacity)
    })
  );
  if (!input.metroCd || !result.records.length) {
    return result;
  }
  const filtered = result.records.filter((row) => renewableRecordMatches(input, row));
  return {
    ...result,
    records: filtered,
    used: filtered.length > 0,
    message:
      filtered.length > 0
        ? `한전 전력데이터개방포털 API에서 ${result.records.length}건을 조회한 뒤 지역 조건에 맞는 ${filtered.length}건을 사용했습니다.`
        : `한전 전력데이터개방포털 API에서 ${result.records.length}건을 조회했지만 지역 조건에 맞는 신재생 계약현황이 없습니다.`
  };
}

export async function fetchKepcoDispersedGeneration(input: {
  metroCd?: string;
  cityCd?: string;
  addrLidong?: string;
  addrLi?: string;
  addrJibun?: string;
  substCd?: string;
}): Promise<KepcoApiResult<KepcoDispersedGeneration>> {
  return callKepco(
    'dispersedGeneration.do',
    {
      metroCd: input.metroCd,
      cityCd: input.cityCd,
      addrLidong: input.addrLidong,
      addrLi: input.addrLi,
      addrJibun: input.addrJibun,
      substCd: input.substCd
    },
    (row) => ({
      substCd: String(row.substCd ?? '').trim() || undefined,
      substNm: String(row.substNm ?? '').trim() || undefined,
      jsSubstPwr: parseFiniteNumber(row.jsSubstPwr),
      substPwr: parseFiniteNumber(row.substPwr),
      mtrNo: String(row.mtrNo ?? '').trim() || undefined,
      jsMtrPwr: parseFiniteNumber(row.jsMtrPwr),
      mtrPwr: parseFiniteNumber(row.mtrPwr),
      dlCd: String(row.dlCd ?? '').trim() || undefined,
      dlNm: String(row.dlNm ?? '').trim() || undefined,
      jsDlPwr: parseFiniteNumber(row.jsDlPwr),
      dlPwr: parseFiniteNumber(row.dlPwr),
      vol1: parseFiniteNumber(row.vol1),
      vol2: parseFiniteNumber(row.vol2),
      vol3: parseFiniteNumber(row.vol3)
    })
  );
}
