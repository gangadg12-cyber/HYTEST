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

const KEPCO_BIGDATA_BASE_URL = 'https://bigdata.kepco.co.kr/openapi/v1';

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
    .replace(/특별시|광역시|특별자치시|특별자치도|자치도|도|시|군|구/g, '');
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
  return callKepco('commonCode.do', { codeTy }, (row) => {
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
