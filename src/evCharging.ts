import { XMLParser } from 'fast-xml-parser';
import { getUserVisibleOfficialDataSources, type IntegrationBoundary, type OfficialDataSource } from './kepcoData.js';

export type ChargerStatus = 'available' | 'charging' | 'reserved' | 'faulted' | 'unknown';

export interface ChargerCandidateInput {
  name: string;
  address?: string;
  routeName?: string;
  direction?: string;
  operator?: string;
  chargerType?: string;
  connectorType?: string;
  outputKw?: number;
  distanceKm?: number;
  status?: ChargerStatus;
  availableCount?: number;
  chargingCount?: number;
  faultedCount?: number;
  totalCount?: number;
  statusUpdatedAt?: string;
  estimatedArrivalMinutes?: number;
}

export interface EvChargingPlanInput {
  text?: string;
  origin?: string;
  destination?: string;
  locationText?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  zcode?: string;
  zscode?: string;
  useLiveApi?: boolean;
  apiPeriodMinutes?: number;
  apiNumOfRows?: number;
  routeName?: string;
  direction?: string;
  arrivalInMinutes?: number;
  desiredKwh?: number;
  connectorType?: string;
  minimumOutputKw?: number;
  candidates?: ChargerCandidateInput[];
}

export interface EvChargingPlanCandidate {
  name: string;
  address?: string;
  routeName?: string;
  direction?: string;
  operator?: string;
  chargerType?: string;
  connectorType?: string;
  outputKw: number;
  distanceKm?: number;
  status: ChargerStatus;
  availableCount: number;
  chargingCount: number;
  faultedCount: number;
  totalCount: number;
  statusUpdatedAt?: string;
  estimatedArrivalMinutes: number;
  estimatedChargeMinutes?: number;
  availabilityScore: number;
  recommendation: 'plan_a' | 'plan_b' | 'avoid';
  reasons: string[];
}

export interface EvChargingPlanResult {
  dataMode: 'provided_candidates' | 'live_public_api' | 'unavailable';
  parsed: {
    origin?: string;
    destination?: string;
    locationText?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    zcode?: string;
    zscode?: string;
    routeName?: string;
    direction?: string;
    arrivalInMinutes: number;
    desiredKwh?: number;
    connectorType?: string;
    minimumOutputKw?: number;
  };
  liveApi?: {
    attempted: boolean;
    used: boolean;
    endpoint?: string;
    zcode?: string;
    zscode?: string;
    fetchedCount?: number;
    candidateCount?: number;
    serviceKeyConfigured: boolean;
    message: string;
  };
  planA?: EvChargingPlanCandidate;
  planB?: EvChargingPlanCandidate;
  candidates: EvChargingPlanCandidate[];
  visitPlanText: string;
  reservationBoundary: {
    currentMvp: string;
    actualReservationRequires: string[];
    integrationBoundary: IntegrationBoundary;
  };
  officialDataSources: OfficialDataSource[];
  disclaimer: string;
}

const KECO_EV_CHARGER_INFO_ENDPOINT = 'http://apis.data.go.kr/B552584/EvCharger/getChargerInfo';
const KECO_EV_CHARGER_TIMEOUT_MS = 25000;
const CONTEST_FALLBACK_EV_CHARGER_SERVICE_KEY =
  '904eb0cc7c3d3fddba7f2827cbe23a019955e96e25cfca1b57b0efd39d1b1247';

const ZCODE_ALIASES: Array<{ zcode: string; aliases: string[] }> = [
  { zcode: '11', aliases: ['서울', '서울특별시'] },
  { zcode: '26', aliases: ['부산', '부산광역시'] },
  { zcode: '27', aliases: ['대구', '대구광역시'] },
  { zcode: '28', aliases: ['인천', '인천광역시'] },
  { zcode: '29', aliases: ['광주', '광주광역시'] },
  { zcode: '30', aliases: ['대전', '대전광역시'] },
  { zcode: '31', aliases: ['울산', '울산광역시'] },
  { zcode: '36', aliases: ['세종', '세종특별자치시'] },
  { zcode: '41', aliases: ['경기', '경기도', '덕평', '이천', '여주'] },
  { zcode: '43', aliases: ['충북', '충청북도'] },
  { zcode: '44', aliases: ['충남', '충청남도'] },
  { zcode: '46', aliases: ['전남', '전라남도'] },
  { zcode: '47', aliases: ['경북', '경상북도'] },
  { zcode: '48', aliases: ['경남', '경상남도'] },
  { zcode: '50', aliases: ['제주', '제주특별자치도'] },
  { zcode: '51', aliases: ['강원', '강원특별자치도', '문막'] },
  { zcode: '52', aliases: ['전북', '전라북도', '전북특별자치도'] }
];

const ZSCODE_ALIASES: Array<{ zcode: string; zscode: string; aliases: string[] }> = [
  { zcode: '11', zscode: '11110', aliases: ['종로구', '종로'] },
  { zcode: '11', zscode: '11140', aliases: ['서울 중구', '서울중구'] },
  { zcode: '11', zscode: '11170', aliases: ['용산구', '용산'] },
  { zcode: '11', zscode: '11200', aliases: ['성동구', '성동'] },
  { zcode: '11', zscode: '11215', aliases: ['광진구', '광진'] },
  { zcode: '11', zscode: '11230', aliases: ['동대문구', '동대문'] },
  { zcode: '11', zscode: '11260', aliases: ['중랑구', '중랑'] },
  { zcode: '11', zscode: '11290', aliases: ['성북구', '성북'] },
  { zcode: '11', zscode: '11305', aliases: ['강북구', '강북'] },
  { zcode: '11', zscode: '11320', aliases: ['도봉구', '도봉'] },
  { zcode: '11', zscode: '11350', aliases: ['노원구', '노원'] },
  { zcode: '11', zscode: '11380', aliases: ['은평구', '은평'] },
  { zcode: '11', zscode: '11410', aliases: ['서대문구', '서대문'] },
  { zcode: '11', zscode: '11440', aliases: ['마포구', '마포'] },
  { zcode: '11', zscode: '11470', aliases: ['양천구', '양천'] },
  { zcode: '11', zscode: '11500', aliases: ['강서구', '강서'] },
  { zcode: '11', zscode: '11530', aliases: ['구로구', '구로'] },
  { zcode: '11', zscode: '11545', aliases: ['금천구', '금천'] },
  { zcode: '11', zscode: '11560', aliases: ['영등포구', '영등포'] },
  { zcode: '11', zscode: '11590', aliases: ['동작구', '동작'] },
  { zcode: '11', zscode: '11620', aliases: ['관악구', '관악'] },
  { zcode: '11', zscode: '11650', aliases: ['서초구', '서초'] },
  { zcode: '11', zscode: '11680', aliases: ['강남구', '강남'] },
  { zcode: '11', zscode: '11710', aliases: ['송파구', '송파'] },
  { zcode: '11', zscode: '11740', aliases: ['강동구', '강동'] },
  { zcode: '41', zscode: '41500', aliases: ['이천시', '이천', '덕평', '덕평휴게소'] },
  { zcode: '41', zscode: '41670', aliases: ['여주시', '여주', '여주휴게소'] },
  { zcode: '51', zscode: '51130', aliases: ['원주시', '원주', '문막', '문막휴게소'] }
];

export function inferEvZcode(locationText?: string): string | undefined {
  if (!locationText) {
    return undefined;
  }
  const compactText = locationText.replace(/\s+/g, '');
  return ZCODE_ALIASES.find((entry) => entry.aliases.some((alias) => compactText.includes(alias.replace(/\s+/g, ''))))?.zcode;
}

export function inferEvZscode(locationText?: string, zcode?: string): { zcode: string; zscode: string } | undefined {
  if (!locationText) {
    return undefined;
  }
  const compactText = locationText.replace(/\s+/g, '');
  const match = ZSCODE_ALIASES.find(
    (entry) =>
      (!zcode || entry.zcode === zcode) &&
      entry.aliases.some((alias) => compactText.includes(alias.replace(/\s+/g, '')))
  );
  return match ? { zcode: match.zcode, zscode: match.zscode } : undefined;
}

function parseNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degree: number) => (degree * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeConnectorType(connectorType?: string): string | undefined {
  if (!connectorType) {
    return undefined;
  }
  const compact = connectorType.replace(/\s+/g, '').toLowerCase();
  if (/차데모|chademo/.test(compact)) {
    return 'CHAdeMO';
  }
  if (/dc콤보|콤보|ccs|dccombo/.test(compact)) {
    return 'DC콤보';
  }
  if (/ac3상|ac\s*3|3상/.test(compact)) {
    return 'AC3상';
  }
  return connectorType.trim();
}

function normalizeConnectorTypes(connectorType?: string): string[] {
  if (!connectorType) {
    return [];
  }
  const compact = connectorType.replace(/\s+/g, '').toLowerCase();
  const connectors: string[] = [];
  if (/차데모|chademo|01|03|05|06/.test(compact)) {
    connectors.push('CHAdeMO');
  }
  if (/dc콤보|콤보|ccs|dccombo|04|05|06/.test(compact)) {
    connectors.push('DC콤보');
  }
  if (/ac3상|ac\s*3|3상|03|06|07/.test(compact)) {
    connectors.push('AC3상');
  }
  if (connectors.length === 0) {
    const normalized = normalizeConnectorType(connectorType);
    return normalized ? [normalized] : [];
  }
  return Array.from(new Set(connectors));
}

function connectorTypeFromKecoCode(chgerType?: string): string | undefined {
  const code = String(chgerType ?? '').padStart(2, '0');
  const labels: Record<string, string> = {
    '01': 'CHAdeMO',
    '02': 'AC완속',
    '03': 'CHAdeMO+AC3상',
    '04': 'DC콤보',
    '05': 'CHAdeMO+DC콤보',
    '06': 'CHAdeMO+AC3상+DC콤보',
    '07': 'AC3상',
    '89': 'H2'
  };
  return labels[code] ?? chgerType;
}

function chargerStatusFromKeco(stat?: string | number): ChargerStatus {
  const code = String(stat ?? '');
  if (code === '2') return 'available';
  if (code === '3') return 'charging';
  if (code === '4' || code === '5') return 'faulted';
  return 'unknown';
}

export function mapKecoChargerInfoItemToCandidate(
  item: Record<string, unknown>,
  input: Pick<EvChargingPlanInput, 'latitude' | 'longitude'>
): ChargerCandidateInput | undefined {
  const name = String(item.statNm ?? item.statnm ?? '').trim();
  if (!name) {
    return undefined;
  }
  const lat = parseNumber(item.lat);
  const lng = parseNumber(item.lng);
  const status = chargerStatusFromKeco(item.stat as string | number | undefined);
  const distanceKm =
    typeof input.latitude === 'number' && typeof input.longitude === 'number' && typeof lat === 'number' && typeof lng === 'number'
      ? Number(haversineKm(input.latitude, input.longitude, lat, lng).toFixed(2))
      : undefined;

  return {
    name,
    address: String(item.addr ?? '').trim() || undefined,
    operator: String(item.busiNm ?? item.bnm ?? '').trim() || undefined,
    chargerType: String(item.chgerType ?? '').trim() || undefined,
    connectorType: connectorTypeFromKecoCode(String(item.chgerType ?? '')),
    outputKw: parseNumber(item.output) ?? parseNumber(item.powerType),
    distanceKm,
    status,
    availableCount: status === 'available' ? 1 : 0,
    chargingCount: status === 'charging' ? 1 : 0,
    faultedCount: status === 'faulted' ? 1 : 0,
    totalCount: 1,
    statusUpdatedAt: String(item.statUpdDt ?? '').trim() || undefined,
    estimatedArrivalMinutes: undefined
  };
}

function numberFromMatch(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return undefined;
}

function parseText(input: EvChargingPlanInput): Required<Pick<EvChargingPlanInput, 'arrivalInMinutes'>> &
  Pick<EvChargingPlanInput, 'desiredKwh' | 'routeName' | 'direction' | 'connectorType' | 'minimumOutputKw'> {
  const text = input.text ?? '';
  const arrivalFromText =
    numberFromMatch(text, [/(\d+(?:\.\d+)?)\s*분\s*(?:뒤|후|이내)/]) ??
    (() => {
      const hours = numberFromMatch(text, [/(\d+(?:\.\d+)?)\s*시간\s*(?:뒤|후|이내)/]);
      return typeof hours === 'number' ? hours * 60 : undefined;
    })();
  const desiredKwh = input.desiredKwh ?? numberFromMatch(text, [/(\d+(?:\.\d+)?)\s*kwh/i, /(\d+(?:\.\d+)?)\s*킬로와트시/]);
  const minimumOutputKw = input.minimumOutputKw ?? numberFromMatch(text, [/(\d+(?:\.\d+)?)\s*kw\s*(?:급|이상|충전기)/i]);

  let routeName = input.routeName;
  if (!routeName) {
    if (text.includes('영동')) routeName = '영동고속도로';
    if (text.includes('경부')) routeName = '경부고속도로';
    if (text.includes('중부')) routeName = '중부고속도로';
    if (text.includes('서해안')) routeName = '서해안고속도로';
  }

  let direction = input.direction;
  if (!direction) {
    if (text.includes('서울방향')) direction = '서울방향';
    if (text.includes('부산방향')) direction = '부산방향';
    if (text.includes('강릉방향')) direction = '강릉방향';
    if (text.includes('인천방향')) direction = '인천방향';
    if (text.includes('목포방향')) direction = '목포방향';
  }

  let connectorType = normalizeConnectorType(input.connectorType);
  if (!connectorType) {
    if (/dc\s*콤보|dc콤보|콤보/i.test(text)) connectorType = 'DC콤보';
    if (/차데모|chademo/i.test(text)) connectorType = 'CHAdeMO';
    if (/ac\s*3상|ac3상/i.test(text)) connectorType = 'AC3상';
  }

  return {
    arrivalInMinutes: input.arrivalInMinutes ?? arrivalFromText ?? 30,
    desiredKwh,
    routeName,
    direction,
    connectorType,
    minimumOutputKw
  };
}

function statusScore(status: ChargerStatus, availableCount: number): number {
  if (availableCount > 0) return 50;
  if (status === 'available') return 45;
  if (status === 'charging') return 18;
  if (status === 'reserved') return 8;
  if (status === 'faulted') return -30;
  return 5;
}

function scoreCandidate(candidate: ChargerCandidateInput, parsed: ReturnType<typeof parseText>): EvChargingPlanCandidate {
  const outputKw = candidate.outputKw ?? 50;
  const status = candidate.status ?? 'unknown';
  const availableCount = candidate.availableCount ?? (status === 'available' ? 1 : 0);
  const chargingCount = candidate.chargingCount ?? (status === 'charging' ? 1 : 0);
  const faultedCount = candidate.faultedCount ?? (status === 'faulted' ? 1 : 0);
  const totalCount = candidate.totalCount ?? Math.max(availableCount + chargingCount + faultedCount, 1);
  const estimatedArrivalMinutes = candidate.estimatedArrivalMinutes ?? parsed.arrivalInMinutes;
  const requestedConnectorType = normalizeConnectorType(parsed.connectorType);
  const candidateConnectorTypes = normalizeConnectorTypes(candidate.connectorType);
  const candidateConnectorType = candidateConnectorTypes.join('+') || candidate.connectorType;
  const connectorMismatch = Boolean(requestedConnectorType && (!candidateConnectorTypes.length || !candidateConnectorTypes.includes(requestedConnectorType)));
  const estimatedChargeMinutes =
    typeof parsed.desiredKwh === 'number' && outputKw > 0 ? Math.ceil((parsed.desiredKwh / outputKw) * 60 * 1.12) : undefined;
  const reasons: string[] = [];
  let score = statusScore(status, availableCount);

  if (candidate.distanceKm !== undefined) {
    score -= Math.min(candidate.distanceKm * 0.25, 20);
    reasons.push(`현재 경로 기준 약 ${candidate.distanceKm}km 후보입니다.`);
  }
  if (availableCount > 0) {
    reasons.push(`현재 사용 가능 충전기 ${availableCount}기가 있습니다.`);
  } else if (chargingCount > 0) {
    reasons.push(`현재 충전중 ${chargingCount}기라 도착 시점 변동 가능성이 있습니다.`);
  }
  if (faultedCount > 0) {
    reasons.push(`고장/점검 추정 충전기 ${faultedCount}기가 있어 우선순위를 낮췄습니다.`);
  }
  if (parsed.minimumOutputKw && outputKw < parsed.minimumOutputKw) {
    score -= 25;
    reasons.push(`${parsed.minimumOutputKw}kW 이상 조건보다 낮은 ${outputKw}kW 충전기입니다.`);
  } else {
    reasons.push(`${outputKw}kW 기준 충전 시간 추정이 가능합니다.`);
  }
  if (connectorMismatch) {
    score -= 100;
    reasons.push(
      candidateConnectorType
        ? `요청 커넥터(${requestedConnectorType})와 후보 커넥터(${candidateConnectorType})가 일치하지 않아 추천 후보에서 제외합니다.`
        : `요청 커넥터(${requestedConnectorType})가 있으나 후보 커넥터 정보가 없어 추천 후보에서 제외합니다.`
    );
  } else if (requestedConnectorType) {
    reasons.push(`요청 커넥터(${requestedConnectorType})와 일치합니다.`);
  }
  if (!candidate.statusUpdatedAt) {
    score -= 5;
    reasons.push('상태 갱신시각이 없어 도착 전 최신 상태 재확인이 필요합니다.');
  }
  if (estimatedArrivalMinutes > 45 && availableCount === 1) {
    score -= 6;
    reasons.push('도착까지 시간이 있어 현재 사용 가능 상태가 바뀔 수 있습니다.');
  }
  if (estimatedChargeMinutes) {
    reasons.push(`${parsed.desiredKwh}kWh 충전에 약 ${estimatedChargeMinutes}분이 필요합니다(충전손실/감속 여유 포함).`);
  }

  const recommendation: EvChargingPlanCandidate['recommendation'] = connectorMismatch ? 'avoid' : score >= 35 ? 'plan_a' : score >= 10 ? 'plan_b' : 'avoid';

  return {
    name: candidate.name,
    address: candidate.address,
    routeName: candidate.routeName,
    direction: candidate.direction,
    operator: candidate.operator,
    chargerType: candidate.chargerType,
    connectorType: candidate.connectorType ?? candidateConnectorType,
    outputKw,
    distanceKm: candidate.distanceKm,
    status,
    availableCount,
    chargingCount,
    faultedCount,
    totalCount,
    statusUpdatedAt: candidate.statusUpdatedAt,
    estimatedArrivalMinutes,
    estimatedChargeMinutes,
    availabilityScore: Math.round(score),
    recommendation,
    reasons
  };
}

function buildVisitPlanText(
  parsed: ReturnType<typeof parseText>,
  dataMode: EvChargingPlanResult['dataMode'],
  planA?: EvChargingPlanCandidate,
  planB?: EvChargingPlanCandidate
): string {
  if (!planA) {
    const connectorNote = parsed.connectorType ? ` 특히 요청 커넥터(${parsed.connectorType})와 정확히 일치하는 후보가 필요합니다.` : '';
    return [
      `현재 조건에 맞는 충전소 후보가 부족합니다.${connectorNote}`,
      '실시간 공공데이터 조회가 실패했거나 조회 결과가 없습니다. 조건을 완화하거나 잠시 후 다시 조회해야 합니다.',
      dataMode === 'live_public_api'
          ? '공공데이터포털 충전소 API 조회 결과에서 조건에 맞는 후보가 부족합니다. 위치 범위, 커넥터 타입, 출력 조건을 완화해 다시 조회할 수 있습니다.'
          : dataMode === 'provided_candidates'
            ? '제공된 후보 기준 방문 플랜이며, 예약 확정은 충전사업자 예약/관제 API 연동이 필요합니다.'
            : 'MCP가 임의 충전소를 추천하지 않습니다. 실시간 API 또는 사용자 제공 후보가 필요합니다.'
    ].join('\n');
  }

  const lines = [
    `[플랜A] ${planA.name}`,
    `- 도착 예상: 약 ${planA.estimatedArrivalMinutes}분 후`,
    `- 현재 상태: ${planA.status}, 사용 가능 ${planA.availableCount}/${planA.totalCount}기`,
    `- 출력/커넥터: ${planA.outputKw}kW, ${planA.connectorType ?? '커넥터 미확인'}`,
    planA.estimatedChargeMinutes ? `- 예상 충전시간: 약 ${planA.estimatedChargeMinutes}분` : '- 예상 충전시간: 희망 kWh 입력 시 계산 가능'
  ];

  if (planB) {
    lines.push('', `[플랜B] ${planB.name}`, `- 현재 상태: ${planB.status}, 사용 가능 ${planB.availableCount}/${planB.totalCount}기`);
  }

  lines.push(
    '',
    dataMode === 'live_public_api'
        ? '공공데이터포털 충전소 API 조회 결과 기준 방문 플랜입니다. 실제 예약 확정은 충전사업자 예약/관제 API 연계가 필요합니다.'
        : dataMode === 'provided_candidates'
          ? '사용자가 제공한 후보 기준 방문 플랜입니다. 실제 예약 확정은 충전사업자 예약/관제 API 연계가 필요합니다.'
          : '실시간 조회 결과가 없어 방문 플랜을 만들지 않았습니다.'
  );
  return lines.join('\n');
}

function extractLocationText(input: EvChargingPlanInput): string | undefined {
  const text = [input.locationText, input.destination, input.origin, input.text].filter(Boolean).join(' ');
  return text.trim() || undefined;
}

function locationKeyword(locationText?: string): string | undefined {
  if (!locationText) {
    return undefined;
  }
  const stopwords = [
    '전기차',
    '충전',
    '충전소',
    '근처',
    '주변',
    '에서',
    '으로',
    '까지',
    '고속도로',
    '방향',
    '분뒤',
    '분후'
  ];
  const compactText = locationText.replace(/\s+/g, '');
  const tokens = locationText
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !stopwords.some((stopword) => token.includes(stopword)));
  return tokens.find((token) => !ZCODE_ALIASES.some((entry) => entry.aliases.includes(token))) ?? (compactText.length >= 2 ? compactText : undefined);
}

function resolveEvArea(input: EvChargingPlanInput): { locationText?: string; zcode?: string; zscode?: string } {
  const locationText = extractLocationText(input);
  const inferredDistrict = inferEvZscode(locationText, input.zcode);
  const zcode = input.zcode ?? inferEvZcode(locationText) ?? inferredDistrict?.zcode;
  const districtWithResolvedZcode = input.zscode ? undefined : inferEvZscode(locationText, zcode);
  return {
    locationText,
    zcode,
    zscode: input.zscode ?? districtWithResolvedZcode?.zscode ?? inferredDistrict?.zscode
  };
}

function buildKecoUrl(input: EvChargingPlanInput, serviceKey: string, zcode?: string, zscode?: string): string {
  const params = new URLSearchParams();
  params.set('pageNo', '1');
  params.set('numOfRows', String(Math.min(Math.max(input.apiNumOfRows ?? 20, 10), 100)));
  if (zcode) {
    params.set('zcode', zcode);
  }
  if (zscode) {
    params.set('zscode', zscode);
  }
  return `${KECO_EV_CHARGER_INFO_ENDPOINT}?ServiceKey=${serviceKey}&${params.toString()}`;
}

function getEvChargerServiceKey(): string | undefined {
  return process.env.EV_CHARGER_SERVICE_KEY || process.env.DATA_GO_KR_SERVICE_KEY || CONTEST_FALLBACK_EV_CHARGER_SERVICE_KEY;
}

function hasEvChargerServiceKey(): boolean {
  return Boolean(getEvChargerServiceKey());
}

function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (error.name === 'AbortError') {
    return `timeout after ${KECO_EV_CHARGER_TIMEOUT_MS}ms`;
  }
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return `${error.message}; cause=${cause.name}: ${cause.message}`;
  }
  if (cause && typeof cause === 'object') {
    const causeRecord = cause as Record<string, unknown>;
    const parts = ['code', 'errno', 'syscall', 'hostname']
      .map((key) => (causeRecord[key] ? `${key}=${String(causeRecord[key])}` : undefined))
      .filter(Boolean);
    return parts.length > 0 ? `${error.message}; ${parts.join(', ')}` : error.message;
  }
  return error.message;
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function filterLiveCandidates(candidates: ChargerCandidateInput[], input: EvChargingPlanInput): ChargerCandidateInput[] {
  const radiusKm = input.radiusKm ?? 15;
  const keyword = locationKeyword(extractLocationText(input));
  return candidates
    .filter((candidate) => {
      if (typeof input.latitude === 'number' && typeof input.longitude === 'number' && typeof candidate.distanceKm === 'number') {
        return candidate.distanceKm <= radiusKm;
      }
      if (!keyword) {
        return true;
      }
      const haystack = `${candidate.name} ${candidate.address ?? ''}`.replace(/\s+/g, '');
      return haystack.includes(keyword.replace(/\s+/g, ''));
    })
    .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY))
    .slice(0, 20);
}

async function fetchKecoEvChargerCandidates(input: EvChargingPlanInput): Promise<{
  candidates: ChargerCandidateInput[];
  endpoint?: string;
  zcode?: string;
  zscode?: string;
  fetchedCount: number;
  message: string;
}> {
  const serviceKey = getEvChargerServiceKey();
  const { locationText, zcode, zscode } = resolveEvArea(input);
  if (!serviceKey) {
    return {
      candidates: [],
      zcode,
      zscode,
      fetchedCount: 0,
      message: 'EV_CHARGER_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY 환경변수가 없어 공공데이터포털 충전소 API를 호출하지 않았습니다.'
    };
  }
  if (!zcode && (typeof input.latitude !== 'number' || typeof input.longitude !== 'number')) {
    return {
      candidates: [],
      fetchedCount: 0,
      zcode,
      zscode,
      message: '충전소 API 조회에는 시도 단위 위치명 또는 zcode가 필요합니다. 예: 서울 강남구, 경기 이천, zcode=11.'
    };
  }

  const endpoint = buildKecoUrl(input, serviceKey, zcode, zscode);
  let response: Response;
  let xml: string;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KECO_EV_CHARGER_TIMEOUT_MS);
  try {
    response = await fetch(endpoint, { signal: controller.signal });
    xml = await response.text();
  } catch (error) {
    return {
      candidates: [],
      endpoint: KECO_EV_CHARGER_INFO_ENDPOINT,
      zcode,
      zscode,
      fetchedCount: 0,
      message: `공공데이터포털 충전소 API 네트워크 오류: ${describeFetchError(error)}`
    };
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    return {
      candidates: [],
      endpoint: KECO_EV_CHARGER_INFO_ENDPOINT,
      zcode,
      zscode,
      fetchedCount: 0,
      message: `공공데이터포털 충전소 API HTTP 오류: ${response.status}`
    };
  }

  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml) as {
    response?: { body?: { items?: { item?: Record<string, unknown> | Array<Record<string, unknown>> }; totalCount?: string | number }; header?: { resultCode?: string; resultMsg?: string } };
    OpenAPI_ServiceResponse?: { cmmMsgHeader?: { errMsg?: string; returnAuthMsg?: string; returnReasonCode?: string } };
  };
  const authError = parsed.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (authError) {
    return {
      candidates: [],
      endpoint: KECO_EV_CHARGER_INFO_ENDPOINT,
      zcode,
      zscode,
      fetchedCount: 0,
      message: `공공데이터포털 충전소 API 인증/호출 오류: ${authError.returnAuthMsg ?? authError.errMsg ?? authError.returnReasonCode ?? 'unknown'}`
    };
  }
  const resultCode = parsed.response?.header?.resultCode;
  if (resultCode && resultCode !== '00') {
    return {
      candidates: [],
      endpoint: KECO_EV_CHARGER_INFO_ENDPOINT,
      zcode,
      zscode,
      fetchedCount: 0,
      message: `공공데이터포털 충전소 API 오류: ${parsed.response?.header?.resultMsg ?? resultCode}`
    };
  }

  const items = ensureArray(parsed.response?.body?.items?.item);
  const mapped = items
    .map((item) => mapKecoChargerInfoItemToCandidate(item, input))
    .filter((candidate): candidate is ChargerCandidateInput => Boolean(candidate));
  const filtered = filterLiveCandidates(mapped, input);
  return {
    candidates: filtered,
    endpoint: KECO_EV_CHARGER_INFO_ENDPOINT,
    zcode,
    zscode,
    fetchedCount: mapped.length,
    message:
      filtered.length > 0
        ? `공공데이터포털 충전소 API에서 ${mapped.length}개 후보를 조회하고 조건에 맞는 ${filtered.length}개 후보를 사용했습니다.`
        : `공공데이터포털 충전소 API에서 ${mapped.length}개 후보를 조회했지만 입력 위치/반경/키워드 조건에 맞는 후보가 없습니다.`
  };
}

function buildEvChargingPlan(
  input: EvChargingPlanInput,
  candidates: ChargerCandidateInput[],
  dataMode: EvChargingPlanResult['dataMode'],
  liveApi?: EvChargingPlanResult['liveApi']
): EvChargingPlanResult {
  const parsed = parseText(input);
  const area = resolveEvArea(input);
  const scored = candidates
    .filter((candidate) => {
      const routeOk = !parsed.routeName || !candidate.routeName || candidate.routeName.includes(parsed.routeName) || parsed.routeName.includes(candidate.routeName);
      const directionOk = !parsed.direction || !candidate.direction || candidate.direction.includes(parsed.direction) || parsed.direction.includes(candidate.direction);
      return routeOk && directionOk;
    })
    .map((candidate) => scoreCandidate(candidate, parsed))
    .sort((a, b) => b.availabilityScore - a.availabilityScore);

  const viable = scored.filter((candidate) => candidate.recommendation !== 'avoid');
  const planA = viable.find((candidate) => candidate.recommendation === 'plan_a') ?? viable[0];
  const planB = scored.find((candidate) => candidate.name !== planA?.name && candidate.recommendation !== 'avoid');

  return {
    dataMode,
    parsed: {
      origin: input.origin,
      destination: input.destination,
      locationText: input.locationText,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      zcode: area.zcode,
      zscode: area.zscode,
      routeName: parsed.routeName,
      direction: parsed.direction,
      arrivalInMinutes: parsed.arrivalInMinutes,
      desiredKwh: parsed.desiredKwh,
      connectorType: parsed.connectorType,
      minimumOutputKw: parsed.minimumOutputKw
    },
    planA,
    planB,
    candidates: scored,
    liveApi,
    visitPlanText: buildVisitPlanText(parsed, dataMode, planA, planB),
    reservationBoundary: {
      currentMvp:
        dataMode === 'live_public_api'
          ? '공공데이터포털 전기차 충전소 정보 API로 조회한 위치/상태 후보 기준 방문 플랜, 대체 후보, 예약 요청서 수준까지 제공합니다.'
          : dataMode === 'provided_candidates'
            ? '제공된 후보 상태 기준 도착시점 방문 플랜, 대체 후보, 예약 요청서 수준까지 제공합니다.'
            : '실시간 공공데이터 조회나 사용자 제공 후보가 없으면 임의 충전소를 추천하지 않습니다.',
      actualReservationRequires: [
        '충전사업자(CPO) 예약/관제 API',
        '충전기 원격 인증 또는 예약 상태 제어',
        '사업자별 예약 생성/취소 기능',
        '회원/차량/결제 수단 연동',
        '노쇼/지연/취소 운영정책'
      ],
      integrationBoundary: 'needs_partner_agreement'
    },
    officialDataSources: getUserVisibleOfficialDataSources().filter((source) =>
      ['keco_ev_charger_api', 'ex_rest_area_charger_data'].includes(source.id)
    ),
    disclaimer:
      dataMode === 'live_public_api'
        ? '공공데이터포털 전기차 충전소 정보 API 조회 결과를 기준으로 한 계획입니다. 실제 점유 상태는 도착 전 다시 확인해야 합니다.'
        : dataMode === 'provided_candidates'
          ? '사용자가 제공한 충전소 후보 상태를 기준으로 한 계획입니다. 실제 점유 상태는 도착 전 다시 확인해야 합니다.'
          : '실시간 공공데이터 조회나 사용자 제공 후보가 없어 방문 플랜을 만들지 않았습니다.'
  };
}

export function planEvChargingVisit(input: EvChargingPlanInput): EvChargingPlanResult {
  if (input.candidates && input.candidates.length > 0) {
    return buildEvChargingPlan(input, input.candidates, 'provided_candidates');
  }
  return buildUnavailableEvChargingPlan(input, '실시간 조회 결과나 사용자가 제공한 충전소 후보가 없어 방문 플랜을 만들 수 없습니다.');
}

function buildUnavailableEvChargingPlan(
  input: EvChargingPlanInput,
  message: string,
  liveApi?: EvChargingPlanResult['liveApi']
): EvChargingPlanResult {
  const parsed = parseText(input);
  const area = resolveEvArea(input);
  return {
    dataMode: 'unavailable',
    parsed: {
      origin: input.origin,
      destination: input.destination,
      locationText: input.locationText,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      zcode: area.zcode,
      zscode: area.zscode,
      routeName: parsed.routeName,
      direction: parsed.direction,
      arrivalInMinutes: parsed.arrivalInMinutes,
      desiredKwh: parsed.desiredKwh,
      connectorType: parsed.connectorType,
      minimumOutputKw: parsed.minimumOutputKw
    },
    liveApi,
    candidates: [],
    visitPlanText: [message, buildVisitPlanText(parsed, 'unavailable')].join('\n'),
    reservationBoundary: {
      currentMvp: '실시간 공공데이터 조회나 사용자 제공 후보가 없으면 임의 충전소를 추천하지 않습니다.',
      actualReservationRequires: [
        '충전사업자(CPO) 예약/관제 API',
        '충전기 원격 인증 또는 예약 상태 제어',
        '사업자별 예약 생성/취소 기능',
        '회원/차량/결제 수단 연동',
        '노쇼/지연/취소 운영정책'
      ],
      integrationBoundary: 'needs_partner_agreement'
    },
    officialDataSources: getUserVisibleOfficialDataSources().filter((source) =>
      ['keco_ev_charger_api', 'ex_rest_area_charger_data'].includes(source.id)
    ),
    disclaimer: message
  };
}

export async function planEvChargingVisitWithLiveData(input: EvChargingPlanInput): Promise<EvChargingPlanResult> {
  if (input.candidates && input.candidates.length > 0) {
    return planEvChargingVisit(input);
  }

  const shouldAttemptLiveApi =
    input.useLiveApi !== false &&
    Boolean(input.locationText || input.zcode || input.zscode || typeof input.latitude === 'number' || typeof input.longitude === 'number' || input.text);
  if (!shouldAttemptLiveApi) {
    return buildUnavailableEvChargingPlan(input, '위치명, zcode, 좌표, 사용자 제공 후보 중 하나가 없어 충전소 조회를 시도하지 않았습니다.');
  }

  const serviceKeyConfigured = hasEvChargerServiceKey();
  const live = await fetchKecoEvChargerCandidates(input);
  if (live.candidates.length > 0) {
    return buildEvChargingPlan(input, live.candidates, 'live_public_api', {
      attempted: true,
      used: true,
      endpoint: live.endpoint,
      zcode: live.zcode,
      zscode: live.zscode,
      fetchedCount: live.fetchedCount,
      candidateCount: live.candidates.length,
      serviceKeyConfigured,
      message: live.message
    });
  }

  return buildUnavailableEvChargingPlan(input, live.message, {
    attempted: true,
    used: false,
    endpoint: live.endpoint,
    zcode: live.zcode,
    zscode: live.zscode,
    fetchedCount: live.fetchedCount,
    candidateCount: 0,
    serviceKeyConfigured,
    message: live.message
  });
}
