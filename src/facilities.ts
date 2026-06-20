import { DISCLAIMER } from './medicalData.js';
import { triageSymptoms } from './triage.js';

export type FacilityNeed = 'emergency_room' | 'pediatric_clinic' | 'moonlight_clinic' | 'specialty_clinic';

export interface FacilityLookupResult {
  mode: 'live_api' | 'fallback_links';
  location: string;
  need: FacilityNeed;
  suggestedSpecialty: string;
  facilities: Array<{
    name: string;
    address?: string;
    phone?: string;
    emergencyPhone?: string;
    mapLink?: string;
    note?: string;
  }>;
  links: Array<{ label: string; url: string }>;
  bookingSupport: string[];
  disclaimer: string;
}

const SIDO_ALIASES: Record<string, string> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도'
};

const facilityCache = new Map<string, { expiresAt: number; facilities: FacilityLookupResult['facilities'] }>();
const FACILITY_CACHE_TTL_MS = 1000 * 60 * 3;

function encodeQuery(value: string): string {
  return encodeURIComponent(value.trim());
}

function inferSpecialty(need: FacilityNeed, symptomText?: string): string {
  if (need === 'emergency_room') {
    return '응급의학과';
  }
  if (need === 'moonlight_clinic') {
    return '달빛어린이병원';
  }
  if (!symptomText) {
    return '소아청소년과';
  }
  const { triage } = triageSymptoms({ text: symptomText });
  return triage.recommendedSpecialties[0] ?? '소아청소년과';
}

function makeLinks(location: string, need: FacilityNeed, specialty: string): FacilityLookupResult['links'] {
  const query =
    need === 'emergency_room'
      ? `${location} 소아 응급실`
      : need === 'moonlight_clinic'
        ? `${location} 달빛어린이병원`
        : `${location} ${specialty}`;

  return [
    {
      label: 'E-Gen 응급의료포털',
      url: 'https://www.e-gen.or.kr/egen/main.do'
    },
    {
      label: '중앙응급의료센터 달빛어린이병원 안내',
      url: 'https://www.nmc.or.kr/nmc/babyList'
    },
    {
      label: '지도 검색',
      url: `https://map.naver.com/p/search/${encodeQuery(query)}`
    }
  ];
}

function splitKoreanRegion(location: string): { sido?: string; sigungu?: string } {
  const tokens = location
    .replace(/[,\n]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {};
  }

  const first = tokens[0] ?? '';
  const sido = SIDO_ALIASES[first] ?? first;
  const sigungu = tokens.find((token) => /구$|시$|군$/.test(token) && token !== first);
  return { sido, sigungu };
}

async function fetchJsonWithTimeout(url: URL, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeItems(payload: unknown): FacilityLookupResult['facilities'] {
  const body = (payload as { response?: { body?: { items?: { item?: unknown } } } }).response?.body;
  const rawItem = body?.items?.item;
  const items = Array.isArray(rawItem) ? rawItem : rawItem ? [rawItem] : [];

  return items.slice(0, 5).map((item) => {
    const record = item as Record<string, unknown>;
    const name = String(record.dutyName ?? record.dutyname ?? record.name ?? '의료기관명 미상');
    const address = record.dutyAddr ? String(record.dutyAddr) : undefined;
    const phone = record.dutyTel1 ? String(record.dutyTel1) : undefined;
    const emergencyPhone = record.dutyTel3 ? String(record.dutyTel3) : undefined;
    const lat = record.wgs84Lat ? String(record.wgs84Lat) : undefined;
    const lon = record.wgs84Lon ? String(record.wgs84Lon) : undefined;
    const mapLink = lat && lon ? `https://map.naver.com/p/search/${encodeQuery(`${lat},${lon}`)}` : undefined;
    return { name, address, phone, emergencyPhone, mapLink };
  });
}

async function tryEmergencyApi(location: string): Promise<FacilityLookupResult['facilities']> {
  const serviceKey = process.env.EGEN_SERVICE_KEY ?? process.env.PUBLIC_DATA_SERVICE_KEY;
  if (!serviceKey) {
    return [];
  }

  const cacheKey = `emergency:${location}`;
  const cached = facilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.facilities;
  }

  const { sido, sigungu } = splitKoreanRegion(location);
  if (!sido) {
    return [];
  }

  const url = new URL('https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire');
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '5');
  url.searchParams.set('_type', 'json');
  url.searchParams.set('Q0', sido);
  if (sigungu) {
    url.searchParams.set('Q1', sigungu);
  }

  try {
    const facilities = normalizeItems(await fetchJsonWithTimeout(url, 950));
    facilityCache.set(cacheKey, { expiresAt: Date.now() + FACILITY_CACHE_TTL_MS, facilities });
    return facilities;
  } catch {
    return [];
  }
}

export async function findFacilities(input: {
  location: string;
  need?: FacilityNeed;
  symptomText?: string;
}): Promise<FacilityLookupResult> {
  const location = input.location.trim();
  const resolvedNeed = input.need ?? inferFacilityNeed(input.symptomText);
  const specialty = inferSpecialty(resolvedNeed, input.symptomText);
  const links = makeLinks(location, resolvedNeed, specialty);
  const liveFacilities = resolvedNeed === 'emergency_room' ? await tryEmergencyApi(location) : [];

  const fallbackFacilities =
    liveFacilities.length > 0
      ? liveFacilities
      : [
          {
            name:
              resolvedNeed === 'emergency_room'
                ? `${location} 인근 응급실 검색 필요`
                : resolvedNeed === 'moonlight_clinic'
                  ? `${location} 달빛어린이병원 검색 필요`
                  : `${location} ${specialty} 검색 필요`,
            note: '현재 서버에 실시간 병원 API 키가 없거나 조회 결과가 없습니다. 제공된 공식 링크/지도 검색으로 운영 여부를 확인하세요.',
            mapLink: links.find((link) => link.label === '지도 검색')?.url
          }
        ];

  return {
    mode: liveFacilities.length > 0 ? 'live_api' : 'fallback_links',
    location,
    need: resolvedNeed,
    suggestedSpecialty: specialty,
    facilities: fallbackFacilities,
    links,
    bookingSupport: [
      '실제 예약 API가 연결되지 않은 경우 자동 예약은 수행하지 않습니다.',
      '전화 문의 시 아이 나이, 체온, 주요 증상, 시작 시각, 위험신호 여부를 먼저 말하세요.',
      '응급 증상이 있으면 예약을 기다리지 말고 119 또는 응급실을 우선 이용하세요.'
    ],
    disclaimer: DISCLAIMER
  };
}

export function inferFacilityNeed(symptomText?: string): FacilityNeed {
  if (!symptomText) {
    return 'pediatric_clinic';
  }

  const { triage } = triageSymptoms({ text: symptomText });
  if (triage.urgency === 'call_119_now' || triage.urgency === 'emergency_room') {
    return 'emergency_room';
  }
  if (triage.urgency === 'urgent_pediatric_care') {
    return 'moonlight_clinic';
  }
  return 'pediatric_clinic';
}

export function prepareBooking(input: {
  location?: string;
  hospitalName?: string;
  symptomText: string;
  preferredTime?: string;
  contactMethod?: 'phone' | 'web' | 'unknown';
}): {
  canAutoBook: false;
  bookingStatus: string;
  requestSummary: string;
  callScript: string;
  nextSteps: string[];
  disclaimer: string;
} {
  const { triage } = triageSymptoms({ text: input.symptomText });
  const target = input.hospitalName ?? (input.location ? `${input.location} 인근 의료기관` : '의료기관');
  const preferredTime = input.preferredTime ?? '가능한 빠른 시간';
  const requestSummary = [
    `대상 의료기관: ${target}`,
    `희망 시간: ${preferredTime}`,
    `긴급도 안내: ${triage.urgencyLabel}`,
    `권장 진료과: ${triage.recommendedSpecialties.join(', ')}`,
    `증상: ${input.symptomText}`
  ].join('\n');

  return {
    canAutoBook: false,
    bookingStatus: '현재 공개 예약 API가 연결되어 있지 않아 자동 예약 대신 문의 준비 정보를 제공합니다.',
    requestSummary,
    callScript: `안녕하세요. 아이 진료 가능 여부 문의드립니다. ${triage.recommendedSpecialties[0] ?? '소아청소년과'} 진료가 필요할 것 같고, 증상은 "${input.symptomText}"입니다. ${preferredTime}에 진료나 예약이 가능할까요?`,
    nextSteps: [
      '의료기관 전화번호 또는 공식 예약 페이지에서 예약 가능 여부를 확인하세요.',
      '응급실 권장 이상으로 분류되면 예약보다 119/응급실 문의를 우선하세요.',
      '전화 전 증상 요약문을 준비하면 접수 시간이 줄어듭니다.'
    ],
    disclaimer: DISCLAIMER
  };
}
