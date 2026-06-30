import { XMLParser } from 'fast-xml-parser';
import { getContestCredential } from './contestCredentials.js';
import { resolveKakaoLocation, type KakaoLocationResult } from './kakaoLocal.js';
import { getUserVisibleOfficialDataSources, type IntegrationBoundary, type OfficialDataSource } from './kepcoData.js';

export type ChargerStatus = 'available' | 'charging' | 'reserved' | 'faulted' | 'unknown';

export interface EvVehicleConnectorMatch {
  vehicleModel: string;
  connectorType: string;
  confidence: 'high' | 'medium' | 'low';
  sourceLabel: string;
  note: string;
}

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
  vehicleModel?: string;
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
    vehicleModel?: string;
    vehicleConnector?: EvVehicleConnectorMatch;
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
    geocoding?: KakaoLocationResult;
    message: string;
  };
  planA?: EvChargingPlanCandidate;
  planB?: EvChargingPlanCandidate;
  candidates: EvChargingPlanCandidate[];
  visitPlanText: string;
  userFacingSummary: string[];
  clarifyingQuestions: string[];
  reservationBoundary: {
    currentMvp: string;
    actualReservationRequires: string[];
    integrationBoundary: IntegrationBoundary;
  };
  officialDataSources: OfficialDataSource[];
  disclaimer: string;
}

const KECO_EV_CHARGER_BASE_URL = 'https://apis.data.go.kr/B552584/EvCharger';
const KECO_EV_CHARGER_INFO_ENDPOINT = `${KECO_EV_CHARGER_BASE_URL}/getChargerInfo`;
const KECO_EV_CHARGER_STATUS_ENDPOINT = `${KECO_EV_CHARGER_BASE_URL}/getChargerStatus`;
const KECO_EV_CHARGER_TIMEOUT_MS = 15000;

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

const EV_VEHICLE_CONNECTOR_PROFILES: Array<EvVehicleConnectorMatch & { aliases: string[] }> = [
  {
    vehicleModel: '현대 아이오닉 5',
    aliases: ['아이오닉5', '아이오닉 5', 'ioniq5', 'ioniq 5'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '현대 아이오닉 6',
    aliases: ['아이오닉6', '아이오닉 6', 'ioniq6', 'ioniq 6'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '기아 EV6',
    aliases: ['ev6', '기아ev6', '기아 ev6'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '기아 니로 EV',
    aliases: ['니로ev', '니로 ev', 'niro ev'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '현대 코나 일렉트릭',
    aliases: ['코나ev', '코나 ev', '코나일렉트릭', 'kona electric'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '쉐보레 볼트 EV',
    aliases: ['볼트ev', '볼트 ev', 'bolt ev'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '현대 포터 II 일렉트릭',
    aliases: ['포터ev', '포터 ev', '포터2ev', '포터2 ev', '포터 일렉트릭', 'porter electric'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '기아 봉고 III EV',
    aliases: ['봉고ev', '봉고 ev', '봉고3ev', '봉고3 ev', 'bongo ev'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '기아 레이 EV 신형',
    aliases: ['신형레이ev', '신형 레이 ev', '레이 ev 신형', '레이ev 신형'],
    connectorType: 'DC콤보',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '레이 EV는 세대별 커넥터 차이가 있어 신형/구형 표현을 우선 확인합니다.'
  },
  {
    vehicleModel: '제네시스 GV60/G80 전동화',
    aliases: ['gv60', 'g80 전동화', '전동화 g80', 'genesis gv60', 'electrified g80'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: 'KG모빌리티 토레스 EVX',
    aliases: ['토레스evx', '토레스 evx', 'torres evx'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '폴스타 2',
    aliases: ['폴스타2', '폴스타 2', 'polestar2', 'polestar 2'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: '폭스바겐 ID.4',
    aliases: ['id4', 'id.4', '폭스바겐 id4', '폭스바겐 id.4'],
    connectorType: 'DC콤보',
    confidence: 'high',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 판매 주요 사양 기준의 급속 충전 커넥터입니다.'
  },
  {
    vehicleModel: 'BMW i4/iX/iX3',
    aliases: ['bmw i4', 'bmw ix', 'bmw ix3', 'i4', 'ix3'],
    connectorType: 'DC콤보',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 공용 급속 충전소 기준으로 매핑했으며 세부 트림/연식 확인이 필요합니다.'
  },
  {
    vehicleModel: '메르세데스-벤츠 EQ 계열',
    aliases: ['eqe', 'eqs', 'eqa', 'eqb', '벤츠 eq', 'benz eq'],
    connectorType: 'DC콤보',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 공용 급속 충전소 기준으로 매핑했으며 세부 트림/연식 확인이 필요합니다.'
  },
  {
    vehicleModel: '아우디 e-tron/Q4 e-tron',
    aliases: ['e-tron', 'etron', 'q4 e-tron', 'q4 etron', '아우디 이트론'],
    connectorType: 'DC콤보',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 공용 급속 충전소 기준으로 매핑했으며 세부 트림/연식 확인이 필요합니다.'
  },
  {
    vehicleModel: '볼보 C40/XC40 Recharge',
    aliases: ['c40 recharge', 'xc40 recharge', '볼보 c40', '볼보 xc40'],
    connectorType: 'DC콤보',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 공용 급속 충전소 기준으로 매핑했으며 세부 트림/연식 확인이 필요합니다.'
  },
  {
    vehicleModel: '테슬라 모델 3/Y',
    aliases: ['모델3', '모델 3', '모델y', '모델 y', 'model3', 'model 3', 'modely', 'model y', '테슬라'],
    connectorType: 'DC콤보',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '국내 공용 급속 충전소 이용은 차량 연식/어댑터/충전소 정책에 따라 달라질 수 있습니다.'
  },
  {
    vehicleModel: '기아 레이 EV 구형',
    aliases: ['레이ev', '레이 ev', 'ray ev'],
    connectorType: 'CHAdeMO',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '구형 차종은 연식별 커넥터 차이가 있을 수 있어 실제 차량 포트를 확인해야 합니다.'
  },
  {
    vehicleModel: '기아 쏘울 EV 1세대',
    aliases: ['쏘울ev', '쏘울 ev', 'soul ev'],
    connectorType: 'CHAdeMO',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: '구형 차종은 연식별 커넥터 차이가 있을 수 있어 실제 차량 포트를 확인해야 합니다.'
  },
  {
    vehicleModel: '르노 SM3 Z.E.',
    aliases: ['sm3 ze', 'sm3 z.e', 'sm3 전기차', 'sm3ze'],
    connectorType: 'AC3상',
    confidence: 'medium',
    sourceLabel: 'Domestic EV connector metadata maintained in MCP source',
    note: 'AC3상 중심의 구형 차종이라 급속 DC콤보 후보와 구분해야 합니다.'
  }
];

export function inferEvConnectorFromVehicleModel(text?: string): EvVehicleConnectorMatch | undefined {
  if (!text) {
    return undefined;
  }
  const compactText = text.replace(/\s+/g, '').toLowerCase();
  const profile = EV_VEHICLE_CONNECTOR_PROFILES.find((entry) =>
    entry.aliases.some((alias) => compactText.includes(alias.replace(/\s+/g, '').toLowerCase()))
  );
  if (!profile) {
    return undefined;
  }
  const { aliases: _aliases, ...match } = profile;
  return match;
}

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
  if (/차데모|chademo/i.test(connectorType)) {
    return 'CHAdeMO';
  }
  if (/dc\s*콤보|dc콤보|콤보|ccs|dccombo/i.test(connectorType)) {
    return 'DC콤보';
  }
  if (/ac\s*3상|ac3상|3상/i.test(connectorType)) {
    return 'AC3상';
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
  const readableConnectors: string[] = [];
  if (/차데모|chademo/i.test(connectorType)) {
    readableConnectors.push('CHAdeMO');
  }
  if (/dc\s*콤보|dc콤보|콤보|ccs|dccombo/i.test(connectorType)) {
    readableConnectors.push('DC콤보');
  }
  if (/ac\s*3상|ac3상|3상/i.test(connectorType)) {
    readableConnectors.push('AC3상');
  }
  if (readableConnectors.length > 0) {
    return Array.from(new Set(readableConnectors));
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

interface KecoEvParsedResponse {
  response?: {
    body?: {
      items?: { item?: Record<string, unknown> | Array<Record<string, unknown>> };
      totalCount?: string | number;
    };
    header?: { resultCode?: string; resultMsg?: string };
  };
  OpenAPI_ServiceResponse?: {
    cmmMsgHeader?: { errMsg?: string; returnAuthMsg?: string; returnReasonCode?: string };
  };
}

function parseKecoEvItems(xml: string): {
  items: Array<Record<string, unknown>>;
  errorMessage?: string;
} {
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml) as KecoEvParsedResponse;
  const authError = parsed.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (authError) {
    return {
      items: [],
      errorMessage: authError.returnAuthMsg ?? authError.errMsg ?? authError.returnReasonCode ?? 'unknown'
    };
  }
  const resultCode = parsed.response?.header?.resultCode;
  if (resultCode && resultCode !== '00') {
    return {
      items: [],
      errorMessage: parsed.response?.header?.resultMsg ?? resultCode
    };
  }
  return { items: ensureArray(parsed.response?.body?.items?.item) };
}

function chargerKeyFromKecoItem(item: Record<string, unknown>): string | undefined {
  const statId = String(item.statId ?? '').trim();
  const chgerId = String(item.chgerId ?? '').trim();
  return statId && chgerId ? `${statId}:${chgerId}` : undefined;
}

function buildStatusByChargerKey(items: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
  const statusByKey = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const key = chargerKeyFromKecoItem(item);
    if (key) {
      statusByKey.set(key, item);
    }
  }
  return statusByKey;
}

function mergeKecoStatus(
  infoItems: Array<Record<string, unknown>>,
  statusByKey: Map<string, Record<string, unknown>>
): Array<Record<string, unknown>> {
  return infoItems.map((item) => {
    const status = statusByKey.get(chargerKeyFromKecoItem(item) ?? '');
    return status ? { ...item, ...status } : item;
  });
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
  Pick<EvChargingPlanInput, 'desiredKwh' | 'routeName' | 'direction' | 'vehicleModel' | 'connectorType' | 'minimumOutputKw'> & {
    vehicleConnector?: EvVehicleConnectorMatch;
  } {
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
    const directionMatch = text.match(
      /(서울|부산|강릉|목포|광주|대전|대구|인천|춘천|속초|양양|울산|포항|창원|마산|진주|여수|순천|전주|군산|제주)\s*(?:방향|방면|행|쪽)/
    );
    if (directionMatch?.[1]) {
      direction = `${directionMatch[1]}방향`;
    }
  }

  const vehicleConnector = inferEvConnectorFromVehicleModel(input.vehicleModel ?? text);
  let connectorType = normalizeConnectorType(input.connectorType);
  if (!connectorType) {
    if (/dc\s*콤보|dc콤보|콤보/i.test(text)) connectorType = 'DC콤보';
    if (/차데모|chademo/i.test(text)) connectorType = 'CHAdeMO';
    if (/ac\s*3상|ac3상/i.test(text)) connectorType = 'AC3상';
  }

  if (!connectorType && vehicleConnector) {
    connectorType = vehicleConnector.connectorType;
  }

  return {
    arrivalInMinutes: input.arrivalInMinutes ?? arrivalFromText ?? 30,
    desiredKwh,
    routeName,
    direction,
    vehicleModel: input.vehicleModel ?? vehicleConnector?.vehicleModel,
    vehicleConnector,
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
      `아직 추천할 충전소 후보를 확정하지 못했습니다.${connectorNote}`,
      '위치, 차량 모델/커넥터, 충전량 같은 기준이 부족하거나 공공 API 결과가 조건에 맞지 않습니다.',
      dataMode === 'live_public_api'
        ? '공공데이터포털 충전소 API 조회 결과에서 조건에 맞는 후보가 부족합니다. 위치 범위, 커넥터 타입, 출력 조건을 완화해 다시 조회할 수 있습니다.'
        : dataMode === 'provided_candidates'
          ? '제공된 후보 기준 방문 플랜이며, 예약 확정은 충전사업자 예약/관제 API 연동이 필요합니다.'
          : 'MCP가 임의 충전소를 만들어 추천하지는 않습니다. 필요한 정보를 보완하면 다시 조회합니다.'
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

function buildEvUserFacingSummary(input: {
  parsed: ReturnType<typeof parseText>;
  dataMode: EvChargingPlanResult['dataMode'];
  planA?: EvChargingPlanCandidate;
  planB?: EvChargingPlanCandidate;
  clarifyingQuestions: string[];
}): string[] {
  const summary: string[] = [];
  if (input.planA) {
    summary.push(`추천 충전소: ${input.planA.name} (${input.planA.status}, ${input.planA.availableCount}/${input.planA.totalCount}기 사용 가능)`);
    summary.push(`예상 도착 ${input.planA.estimatedArrivalMinutes}분, 출력 ${input.planA.outputKw}kW, 커넥터 ${input.planA.connectorType ?? '미확인'}`);
  } else {
    summary.push(
      input.dataMode === 'live_public_api'
        ? '공개 EV 충전소 API 조회 결과에서 조건에 맞는 후보를 찾지 못했습니다.'
        : '제공된 후보나 실시간 API 결과가 없어 방문 플랜을 확정하지 못했습니다.'
    );
  }
  if (input.parsed.vehicleConnector) {
    summary.push(
      `차량 모델 기준 커넥터 추정: ${input.parsed.vehicleConnector.vehicleModel} -> ${input.parsed.vehicleConnector.connectorType} (${input.parsed.vehicleConnector.confidence})`
    );
  }
  if (input.planB) {
    summary.push(`대안 후보: ${input.planB.name} (${input.planB.status})`);
  }
  if (input.clarifyingQuestions.length > 0) {
    return input.clarifyingQuestions.slice(0, 3);
  }
  return summary.slice(0, 5);
}

const BROAD_REGION_ALIASES = new Set([
  '서울',
  '서울특별시',
  '부산',
  '부산광역시',
  '대구',
  '대구광역시',
  '인천',
  '인천광역시',
  '광주',
  '광주광역시',
  '대전',
  '대전광역시',
  '울산',
  '울산광역시',
  '세종',
  '세종특별자치시',
  '경기',
  '경기도',
  '강원',
  '강원특별자치도',
  '충북',
  '충청북도',
  '충남',
  '충청남도',
  '전북',
  '전라북도',
  '전북특별자치도',
  '전남',
  '전라남도',
  '경북',
  '경상북도',
  '경남',
  '경상남도',
  '제주',
  '제주특별자치도'
]);

const EV_LOCATION_STOPWORDS = [
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
  '분후',
  '중인데',
  '중',
  '가는',
  '가고',
  '가는중',
  '찾아',
  '찾아줘',
  '알려',
  '추천',
  '계획',
  '세워줘',
  '짜줘',
  '잡아줘',
  '플랜',
  '방문',
  '곳',
  '할',
  '가까운',
  '가능',
  '사용가능',
  '지금',
  '현재',
  '내위치',
  '위치',
  '근처',
  '주변',
  '부근',
  '차량',
  '모델',
  '커넥터',
  '아이오닉',
  'ioniq',
  'ev6',
  '니로',
  '코나',
  '테슬라',
  'tesla',
  '모델3',
  'model3',
  'modely',
  'dc콤보',
  'dccombo',
  'chademo',
  'ac3상'
];

function normalizeLocationToken(token: string): string {
  return token
    .replace(/[.,!?()[\]{}]/g, '')
    .replace(/(?:에서|으로|까지|부터|쪽으로|쪽|근처|주변|부근|인근|가는|가|은|는|이|가|을|를|에)$/g, '')
    .trim();
}

function removeDirectionOnlyHints(text: string): string {
  return text.replace(
    /(?:서울|부산|강릉|목포|광주|대전|대구|인천|춘천|속초|양양|울산|포항|창원|마산|진주|여수|순천|전주|군산|제주)\s*(?:방향|방면|행|쪽)/g,
    ' '
  );
}

function locationCandidateTokens(text?: string): string[] {
  if (!text) {
    return [];
  }
  return removeDirectionOnlyHints(text)
    .replace(/\d+(?:\.\d+)?\s*(?:분|시간|kwh|kw|w|km|킬로|키로)/gi, ' ')
    .split(/[\s,/]+/)
    .map(normalizeLocationToken)
    .filter(
      (token) =>
        token.length >= 2 &&
        !EV_LOCATION_STOPWORDS.some((stopword) => token.toLowerCase().includes(stopword.toLowerCase())) &&
        !/^\d+$/.test(token)
    );
}

function isBroadRegionToken(token: string): boolean {
  return BROAD_REGION_ALIASES.has(token.replace(/\s+/g, ''));
}

function hasSpecificLocationHint(text?: string): boolean {
  if (!text) {
    return false;
  }
  const withoutDirection = removeDirectionOnlyHints(text);
  if (/(?:특별시|광역시|특별자치시|특별자치도|휴게소|IC|JC|나들목|분기점|역|공항|터미널|주차장)/i.test(withoutDirection)) {
    return true;
  }
  if (/[가-힣A-Za-z0-9]{2,}(?:시|군|구|동|읍|면|리)(?:\s|$|,|\.|근처|주변|부근|에서|까지|로|으로)/i.test(withoutDirection)) {
    return true;
  }
  const compactText = withoutDirection.replace(/\s+/g, '');
  return [...ZCODE_ALIASES, ...ZSCODE_ALIASES].some((entry) =>
    entry.aliases.some((alias) => {
      const compactAlias = alias.replace(/\s+/g, '');
      return (
        compactAlias.length >= 2 &&
        compactText.includes(compactAlias) &&
        !compactText.includes(`${compactAlias}방향`) &&
        !compactText.includes(`${compactAlias}방면`) &&
        !compactText.includes(`${compactAlias}행`)
      );
    })
  );
}

function hasBroadLocationOnly(text?: string): boolean {
  const tokens = locationCandidateTokens(text);
  return tokens.length > 0 && tokens.every(isBroadRegionToken);
}

function hasSpecificTextLocation(text?: string): boolean {
  if (!text) {
    return false;
  }
  const tokens = locationCandidateTokens(text);
  if (tokens.length === 0 || tokens.every(isBroadRegionToken)) {
    return false;
  }
  return true;
}

type EvLocationResolutionNeed = 'specific' | 'route_only' | 'too_broad' | 'missing';

function getEvLocationResolutionNeed(input: EvChargingPlanInput): EvLocationResolutionNeed {
  const explicitText = [input.locationText, input.destination, input.origin].filter(Boolean).join(' ').trim();
  if (
    input.zscode ||
    (typeof input.latitude === 'number' && typeof input.longitude === 'number') ||
    hasSpecificTextLocation(explicitText) ||
    (!hasBroadLocationOnly(explicitText) && hasSpecificLocationHint(explicitText))
  ) {
    return 'specific';
  }
  if (input.zcode) {
    return 'too_broad';
  }

  const parsed = parseText(input);
  const text = explicitText || input.text?.trim();
  const hasSpecificAnchor = hasSpecificLocationHint(text);
  if (text && (parsed.routeName || parsed.direction) && !hasSpecificAnchor) {
    return 'route_only';
  }
  if (input.zcode && (parsed.routeName || parsed.direction) && !hasSpecificAnchor) {
    return 'route_only';
  }
  if (!text || locationCandidateTokens(text).length === 0) {
    return 'missing';
  }
  if (hasBroadLocationOnly(text)) {
    return 'too_broad';
  }
  return hasSpecificTextLocation(text) || (!hasBroadLocationOnly(text) && hasSpecificLocationHint(text)) ? 'specific' : 'missing';
}

function extractLocationText(input: EvChargingPlanInput): string | undefined {
  const explicitText = [input.locationText, input.destination, input.origin].filter(Boolean).join(' ').trim();
  if (explicitText && getEvLocationResolutionNeed(input) === 'specific') {
    return explicitText;
  }
  return getEvLocationResolutionNeed(input) === 'specific' ? input.text?.trim() || undefined : undefined;
}

function locationKeyword(locationText?: string): string | undefined {
  if (!locationText) {
    return undefined;
  }
  const compactText = locationText.replace(/\s+/g, '');
  const tokens = locationCandidateTokens(locationText);
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

async function enrichEvInputWithKakaoLocation(input: EvChargingPlanInput): Promise<{
  input: EvChargingPlanInput;
  geocoding?: KakaoLocationResult;
}> {
  if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
    return { input };
  }
  const locationText = extractLocationText(input);
  if (!locationText) {
    return { input };
  }
  const geocoding = await resolveKakaoLocation(locationText);
  if (!geocoding.used || !geocoding.location) {
    return { input, geocoding };
  }
  const location = geocoding.location;
  return {
    geocoding,
    input: {
      ...input,
      latitude: location.latitude,
      longitude: location.longitude,
      locationText: [input.locationText, location.placeName, location.addressName, location.roadAddressName]
        .filter(Boolean)
        .join(' ')
    }
  };
}

function buildKecoUrl(endpoint: string, input: EvChargingPlanInput, serviceKey: string, zcode?: string): string {
  const params = new URLSearchParams();
  params.set('pageNo', '1');
  const defaultRows = typeof input.latitude === 'number' && typeof input.longitude === 'number' ? 1000 : 100;
  params.set('numOfRows', String(Math.min(Math.max(input.apiNumOfRows ?? defaultRows, 10), 9999)));
  if (endpoint === KECO_EV_CHARGER_STATUS_ENDPOINT) {
    params.set('period', String(Math.min(Math.max(input.apiPeriodMinutes ?? 5, 1), 10)));
  }
  if (zcode) {
    params.set('zcode', zcode);
  }
  return `${endpoint}?ServiceKey=${serviceKey}&${params.toString()}`;
}

function getEvChargerServiceKey(): string | undefined {
  return getContestCredential('EV_CHARGER_SERVICE_KEY') || getContestCredential('DATA_GO_KR_SERVICE_KEY');
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
      if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
        return true;
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
      message: '서버 소스코드에 EV_CHARGER_SERVICE_KEY 또는 DATA_GO_KR_SERVICE_KEY가 등록되어 있지 않아 공공데이터포털 충전소 API를 호출하지 않았습니다.'
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

  const infoEndpoint = buildKecoUrl(KECO_EV_CHARGER_INFO_ENDPOINT, input, serviceKey, zcode);
  const statusEndpoint = buildKecoUrl(KECO_EV_CHARGER_STATUS_ENDPOINT, input, serviceKey, zcode);
  let response: Response;
  let xml: string;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KECO_EV_CHARGER_TIMEOUT_MS);
  try {
    response = await fetch(infoEndpoint, { signal: controller.signal });
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

  let items = ensureArray(parsed.response?.body?.items?.item);
  let statusMessage = '';
  const statusController = new AbortController();
  const statusTimeout = setTimeout(() => statusController.abort(), KECO_EV_CHARGER_TIMEOUT_MS);
  try {
    const statusResponse = await fetch(statusEndpoint, { signal: statusController.signal });
    const statusXml = await statusResponse.text();
    if (statusResponse.ok) {
      const status = parseKecoEvItems(statusXml);
      if (status.errorMessage) {
        statusMessage = ` 상태 조회는 실패했습니다: ${status.errorMessage}`;
      } else if (status.items.length > 0) {
        items = mergeKecoStatus(items, buildStatusByChargerKey(status.items));
        statusMessage = ` 상태 조회 ${status.items.length}건을 병합했습니다.`;
      }
    } else {
      statusMessage = ` 상태 조회 HTTP 오류: ${statusResponse.status}`;
    }
  } catch (error) {
    statusMessage = ` 상태 조회 네트워크 오류: ${describeFetchError(error)}`;
  } finally {
    clearTimeout(statusTimeout);
  }
  const mapped = items
    .map((item) => mapKecoChargerInfoItemToCandidate(item, input))
    .filter((candidate): candidate is ChargerCandidateInput => Boolean(candidate));
  const filtered = filterLiveCandidates(mapped, input);
  return {
    candidates: filtered,
    endpoint: `${KECO_EV_CHARGER_INFO_ENDPOINT}; ${KECO_EV_CHARGER_STATUS_ENDPOINT}`,
    zcode,
    zscode,
    fetchedCount: mapped.length,
    message:
      (filtered.length > 0
        ? `공공데이터포털 전기차 충전소 정보 API에서 ${mapped.length}개 후보를 조회하고 조건에 맞는 ${filtered.length}개 후보를 사용했습니다.`
        : `공공데이터포털 전기차 충전소 정보 API에서 ${mapped.length}개 후보를 조회했지만 입력 위치/반경/커넥터/출력 조건에 맞는 후보가 없습니다. 좌표가 있다면 radiusKm를 넓히거나 커넥터/출력 조건을 완화해 다시 조회할 수 있습니다.`) + statusMessage
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
  const clarifyingQuestions = planA
    ? []
    : ['충전소를 찾을 위치명 또는 zcode/좌표, 차량 커넥터 타입, 원하는 충전량(kWh)을 알려주세요.'];

  return {
    dataMode,
    parsed: {
      origin: input.origin,
      destination: input.destination,
      locationText: input.locationText ?? area.locationText,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      zcode: area.zcode,
      zscode: area.zscode,
      routeName: parsed.routeName,
      direction: parsed.direction,
      arrivalInMinutes: parsed.arrivalInMinutes,
      desiredKwh: parsed.desiredKwh,
      vehicleModel: parsed.vehicleModel,
      vehicleConnector: parsed.vehicleConnector,
      connectorType: parsed.connectorType,
      minimumOutputKw: parsed.minimumOutputKw
    },
    planA,
    planB,
    candidates: scored,
    liveApi,
    visitPlanText: buildVisitPlanText(parsed, dataMode, planA, planB),
    userFacingSummary: buildEvUserFacingSummary({ parsed, dataMode, planA, planB, clarifyingQuestions }),
    clarifyingQuestions,
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
  const locationNeed = getEvLocationResolutionNeed(input);
  const locationClarifyingQuestion =
    locationNeed === 'route_only'
      ? '고속도로명과 방향만으로는 주변 충전소를 확정하기 어렵습니다. 현재 지나고 있는 IC/휴게소, 출발지와 목적지, 또는 30분 뒤 도착할 지점 중 하나를 알려주세요. 예: 천안IC 근처, 서산휴게소 지나기 전, 서울 출발/목포 도착.'
      : locationNeed === 'too_broad'
        ? '조회 범위가 넓어 충전소 후보가 너무 많습니다. 시군구/동, 건물명, 역, 휴게소, IC 중 하나를 더 구체적으로 입력해 주세요. 예: 부산 해운대구, 대전 유성구, 덕평휴게소.'
        : locationNeed === 'missing'
          ? '충전소를 찾을 기준 위치가 필요합니다. 현재 위치, 목적지, 주변 건물명, 휴게소, IC 중 하나를 입력해 주세요. 예: 서울 강남구, 코엑스, 덕평휴게소, 천안IC.'
          : undefined;
  const clarifyingQuestions = [
    locationClarifyingQuestion,
    !parsed.connectorType ? '차량 모델 또는 커넥터 타입(예: DC콤보, CHAdeMO, AC3상)을 알려주세요.' : undefined,
    !parsed.desiredKwh ? '원하는 충전량(kWh)을 알려주면 방문 플랜을 더 정확히 만들 수 있습니다.' : undefined
  ].filter((question): question is string => Boolean(question));
  return {
    dataMode: 'unavailable',
    parsed: {
      origin: input.origin,
      destination: input.destination,
      locationText: input.locationText ?? area.locationText,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusKm: input.radiusKm,
      zcode: area.zcode,
      zscode: area.zscode,
      routeName: parsed.routeName,
      direction: parsed.direction,
      arrivalInMinutes: parsed.arrivalInMinutes,
      desiredKwh: parsed.desiredKwh,
      vehicleModel: parsed.vehicleModel,
      vehicleConnector: parsed.vehicleConnector,
      connectorType: parsed.connectorType,
      minimumOutputKw: parsed.minimumOutputKw
    },
    liveApi,
    candidates: [],
    visitPlanText: [message, buildVisitPlanText(parsed, 'unavailable')].join('\n'),
    userFacingSummary: buildEvUserFacingSummary({ parsed, dataMode: 'unavailable', clarifyingQuestions }),
    clarifyingQuestions,
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

  const locationNeed = getEvLocationResolutionNeed(input);
  if (locationNeed !== 'specific') {
    return buildUnavailableEvChargingPlan(input, '충전소를 찾을 위치를 먼저 확정해야 합니다.');
  }

  const shouldAttemptLiveApi =
    input.useLiveApi !== false &&
    Boolean(
      input.locationText ||
        input.zcode ||
        input.zscode ||
        input.origin ||
        input.destination ||
        typeof input.latitude === 'number' ||
        typeof input.longitude === 'number' ||
        extractLocationText(input)
  );
  if (!shouldAttemptLiveApi) {
    return buildUnavailableEvChargingPlan(input, '실시간 공공 충전소 조회가 꺼져 있어 후보를 가져오지 않았습니다. 조회하려면 실시간 API 사용을 켜거나 후보 충전소 목록을 함께 제공해야 합니다.');
  }

  const serviceKeyConfigured = hasEvChargerServiceKey();
  const enriched = await enrichEvInputWithKakaoLocation(input);
  const live = await fetchKecoEvChargerCandidates(enriched.input);
  if (live.candidates.length > 0) {
    return buildEvChargingPlan(enriched.input, live.candidates, 'live_public_api', {
      attempted: true,
      used: true,
      endpoint: live.endpoint,
      zcode: live.zcode,
      zscode: live.zscode,
      fetchedCount: live.fetchedCount,
      candidateCount: live.candidates.length,
      serviceKeyConfigured,
      geocoding: enriched.geocoding,
      message: live.message
    });
  }

  return buildUnavailableEvChargingPlan(enriched.input, live.message, {
    attempted: true,
    used: false,
    endpoint: live.endpoint,
    zcode: live.zcode,
    zscode: live.zscode,
    fetchedCount: live.fetchedCount,
    candidateCount: 0,
    serviceKeyConfigured,
    geocoding: enriched.geocoding,
    message: live.message
  });
}
