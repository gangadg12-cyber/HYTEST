import { fetchStructuredWithTimeout, firstConfiguredCredential, parseFiniteNumber } from './publicApiClient.js';

export interface KakaoResolvedLocation {
  query: string;
  source: 'keyword' | 'address';
  placeName?: string;
  addressName?: string;
  roadAddressName?: string;
  latitude: number;
  longitude: number;
  region1DepthName?: string;
  region2DepthName?: string;
}

export interface KakaoLocationResult {
  attempted: boolean;
  used: boolean;
  serviceKeyConfigured: boolean;
  endpoint?: string;
  message: string;
  location?: KakaoResolvedLocation;
}

interface KakaoKeywordResponse {
  documents?: Array<{
    place_name?: string;
    address_name?: string;
    road_address_name?: string;
    x?: string;
    y?: string;
  }>;
}

interface KakaoAddressResponse {
  documents?: Array<{
    address_name?: string;
    road_address?: { address_name?: string; region_1depth_name?: string; region_2depth_name?: string };
    address?: { address_name?: string; region_1depth_name?: string; region_2depth_name?: string };
    x?: string;
    y?: string;
  }>;
}

const KAKAO_KEYWORD_ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_ADDRESS_ENDPOINT = 'https://dapi.kakao.com/v2/local/search/address.json';
const LOCATION_STOPWORDS = [
  '근처',
  '주변',
  '부근',
  '인근',
  '에서',
  '으로',
  '까지',
  '전기차',
  '충전소',
  '충전',
  '찾아줘',
  '추천',
  '방문',
  '플랜'
];

function getKakaoRestKey(): string | undefined {
  return firstConfiguredCredential(['KAKAO_REST_API_KEY', 'KAKAO_MOBILITY_REST_API_KEY']).value;
}

function compactText(text: string): string {
  return text.replace(/\s+/g, '');
}

function cleanLocationQuery(query: string): string {
  let cleaned = query.trim();
  for (const stopword of LOCATION_STOPWORDS) {
    cleaned = cleaned.replaceAll(stopword, ' ');
  }
  cleaned = cleaned.replace(/\d+\s*분\s*(뒤|후)?/g, ' ');
  cleaned = cleaned.replace(/\d+(?:\.\d+)?\s*kwh/gi, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || query.trim();
}

function looksLikeAddressOrAdminArea(query: string): boolean {
  return /(특별시|광역시|특별자치시|특별자치도|도|시|군|구|읍|면|동|로|길|\d)/.test(query);
}

function scoreKeywordDocument(query: string, doc: NonNullable<KakaoKeywordResponse['documents']>[number]): number {
  const compactQuery = compactText(query);
  const place = compactText(doc.place_name ?? '');
  const address = compactText(`${doc.address_name ?? ''} ${doc.road_address_name ?? ''}`);
  let score = 0;
  if (place === compactQuery) score += 80;
  if (place.includes(compactQuery)) score += 45;
  if (address.includes(compactQuery)) score += 35;
  for (const token of query.split(/\s+/).filter((value) => value.length >= 2)) {
    const compactToken = compactText(token);
    if (place.includes(compactToken)) score += 12;
    if (address.includes(compactToken)) score += 8;
  }
  return score;
}

function locationFromKeyword(query: string, response: KakaoKeywordResponse): KakaoResolvedLocation | undefined {
  const docs = response.documents ?? [];
  const doc = docs
    .slice()
    .sort((a, b) => scoreKeywordDocument(query, b) - scoreKeywordDocument(query, a))[0];
  const longitude = parseFiniteNumber(doc?.x);
  const latitude = parseFiniteNumber(doc?.y);
  if (!doc || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return undefined;
  }
  return {
    query,
    source: 'keyword',
    placeName: doc.place_name,
    addressName: doc.address_name,
    roadAddressName: doc.road_address_name,
    latitude,
    longitude
  };
}

function locationFromAddress(query: string, response: KakaoAddressResponse): KakaoResolvedLocation | undefined {
  const doc = response.documents?.[0];
  const longitude = parseFiniteNumber(doc?.x);
  const latitude = parseFiniteNumber(doc?.y);
  if (!doc || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return undefined;
  }
  return {
    query,
    source: 'address',
    addressName: doc.address_name ?? doc.address?.address_name,
    roadAddressName: doc.road_address?.address_name,
    latitude,
    longitude,
    region1DepthName: doc.address?.region_1depth_name ?? doc.road_address?.region_1depth_name,
    region2DepthName: doc.address?.region_2depth_name ?? doc.road_address?.region_2depth_name
  };
}

async function callKakao(endpoint: string, query: string): Promise<{ ok: boolean; endpoint: string; data?: unknown; message: string }> {
  const key = getKakaoRestKey();
  if (!key) {
    return {
      ok: false,
      endpoint,
      message: 'KAKAO_REST_API_KEY가 설정되어 있지 않아 카카오 위치 API를 호출하지 않았습니다.'
    };
  }
  const params = new URLSearchParams({ query, size: '5' });
  const result = await fetchStructuredWithTimeout(
    `${endpoint}?${params.toString()}`,
    { headers: { Authorization: `KakaoAK ${key}` } },
    12000
  );
  return {
    ok: result.ok,
    endpoint,
    data: result.data,
    message: result.ok ? 'OK' : result.message
  };
}

export async function resolveKakaoLocation(query?: string): Promise<KakaoLocationResult> {
  const normalizedQuery = query?.trim();
  const serviceKeyConfigured = Boolean(getKakaoRestKey());
  if (!normalizedQuery) {
    return {
      attempted: false,
      used: false,
      serviceKeyConfigured,
      message: '위치 텍스트가 없어 카카오 위치 API를 호출하지 않았습니다.'
    };
  }
  if (!serviceKeyConfigured) {
    return {
      attempted: false,
      used: false,
      serviceKeyConfigured,
      endpoint: KAKAO_KEYWORD_ENDPOINT,
      message: 'KAKAO_REST_API_KEY가 설정되어 있지 않아 카카오 위치 API를 호출하지 않았습니다.'
    };
  }

  const cleanedQuery = cleanLocationQuery(normalizedQuery);
  const tryAddressFirst = looksLikeAddressOrAdminArea(cleanedQuery);
  const address = tryAddressFirst ? await callKakao(KAKAO_ADDRESS_ENDPOINT, cleanedQuery) : undefined;
  if (address?.ok) {
    const location = locationFromAddress(cleanedQuery, address.data as KakaoAddressResponse);
    if (location) {
      return {
        attempted: true,
        used: true,
        serviceKeyConfigured,
        endpoint: address.endpoint,
        message: cleanedQuery === normalizedQuery ? '카카오 주소 검색으로 위치를 확인했습니다.' : `카카오 주소 검색으로 위치를 확인했습니다. 정제 검색어: ${cleanedQuery}`,
        location
      };
    }
  }

  const keyword = await callKakao(KAKAO_KEYWORD_ENDPOINT, cleanedQuery);
  if (keyword.ok) {
    const location = locationFromKeyword(cleanedQuery, keyword.data as KakaoKeywordResponse);
    if (location) {
      return {
        attempted: true,
        used: true,
        serviceKeyConfigured,
        endpoint: keyword.endpoint,
        message: cleanedQuery === normalizedQuery ? '카카오 키워드 검색으로 위치를 확인했습니다.' : `카카오 키워드 검색으로 위치를 확인했습니다. 정제 검색어: ${cleanedQuery}`,
        location
      };
    }
  }

  const fallbackAddress = tryAddressFirst ? undefined : await callKakao(KAKAO_ADDRESS_ENDPOINT, cleanedQuery);
  if (fallbackAddress?.ok) {
    const location = locationFromAddress(cleanedQuery, fallbackAddress.data as KakaoAddressResponse);
    if (location) {
      return {
        attempted: true,
        used: true,
        serviceKeyConfigured,
        endpoint: fallbackAddress.endpoint,
        message: cleanedQuery === normalizedQuery ? '카카오 주소 검색으로 위치를 확인했습니다.' : `카카오 주소 검색으로 위치를 확인했습니다. 정제 검색어: ${cleanedQuery}`,
        location
      };
    }
  }

  return {
    attempted: true,
    used: false,
    serviceKeyConfigured,
    endpoint: KAKAO_KEYWORD_ENDPOINT,
    message: `카카오 위치 API에서 "${normalizedQuery}"에 맞는 좌표를 찾지 못했습니다. 정제 검색어=${cleanedQuery}, keyword=${keyword.message}, address=${address?.message ?? fallbackAddress?.message ?? 'not attempted'}`
  };
}
