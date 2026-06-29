import { getContestCredential } from './contestCredentials.js';

export type PublicApiArea =
  | 'bill'
  | 'home_usage'
  | 'civil_service'
  | 'ev_charging'
  | 'location'
  | 'weather'
  | 'solar'
  | 'power_grid';

export type PublicApiRuntimeStatus =
  | 'implemented'
  | 'configured_endpoint_required'
  | 'service_key_required'
  | 'partner_or_auth_required'
  | 'catalog_only';

export type ApiDataMode = 'live_public_api' | 'official_static' | 'user_provided' | 'unavailable';

export interface PublicApiDefinition {
  code: string;
  label: string;
  provider: string;
  area: PublicApiArea;
  sourceUrl: string;
  auth: 'none' | 'service_key' | 'user_auth_or_partner';
  credentialNames: string[];
  runtimeStatus: PublicApiRuntimeStatus;
  usedFor: string[];
  mvpBoundary: string;
}

export interface ApiReadiness {
  code: string;
  label: string;
  area: PublicApiArea;
  runtimeStatus: PublicApiRuntimeStatus;
  ready: boolean;
  missingCredentialNames: string[];
  mvpBoundary: string;
}

export const PUBLIC_API_CATALOG: PublicApiDefinition[] = [
  {
    code: 'K1',
    label: '한국전력공사 전기요금표 / 주택용 전기요금표',
    provider: '한국전력공사',
    area: 'bill',
    sourceUrl: 'https://www.data.go.kr/data/15090700/fileData.do',
    auth: 'none',
    credentialNames: [],
    runtimeStatus: 'implemented',
    usedFor: ['사용량 기반 예상 전기요금 계산', '누진구간 설명', '요금 절감 시뮬레이션'],
    mvpBoundary: '현재 서버 내 공식 요금표 기준 계산으로 구현되어 있으며, 요금표 개정 시 데이터 갱신이 필요합니다.'
  },
  {
    code: 'K2',
    label: '한국전력공사 가구 평균 전력사용량',
    provider: '한국전력공사',
    area: 'home_usage',
    sourceUrl: 'https://bigdata.kepco.co.kr/openapi/v1/powerUsage/houseAve.do',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['우리집 사용량 평균 비교', '가구원수/계절별 평균 안내'],
    mvpBoundary: '월 사용량과 지역이 있으면 공통코드 조회 후 houseAve.do를 호출합니다. API가 404/무응답이면 임의 평균값 없이 unavailable로 반환합니다.'
  },
  {
    code: 'K3',
    label: '한국전력공사 계약종별 전력사용량',
    provider: '한국전력공사',
    area: 'home_usage',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'configured_endpoint_required',
    usedFor: ['주택용/일반용/산업용 사용량 비교', '평균판매단가 비교'],
    mvpBoundary: '개인 고객 사용량 조회가 아니라 공개 통계 비교용입니다.'
  },
  {
    code: 'K4',
    label: '한국전력공사 지역별/용도별 전력사용량',
    provider: '한국전력공사',
    area: 'home_usage',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'configured_endpoint_required',
    usedFor: ['우리 지역 전력 사용량 비교', '지역 전력 소비 트렌드'],
    mvpBoundary: '공개 통계 기반 비교만 가능하며 개인 사용량 조회는 불가합니다.'
  },
  {
    code: 'K6',
    label: '한국전력공사 복지할인 코드/대상 안내',
    provider: '한국전력공사',
    area: 'civil_service',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'service_key_required',
    usedFor: ['복지할인 유형 안내', '할인 신청 경로 안내'],
    mvpBoundary: '할인 대상 최종 판정과 신청은 한전ON 인증 또는 공식 연계가 필요합니다.'
  },
  {
    code: 'K7',
    label: '한국전력공사 한전ON 자주묻는 질문답변 FAQ',
    provider: '한국전력공사',
    area: 'civil_service',
    sourceUrl: 'https://www.data.go.kr/data/3068685/fileData.do',
    auth: 'none',
    credentialNames: [],
    runtimeStatus: 'catalog_only',
    usedFor: ['이사정산', '명의변경', '납부', '전기사용신청 FAQ 안내'],
    mvpBoundary: '현재는 63개 민원 카탈로그 중심으로 안내하며, FAQ API는 툴 충돌 방지를 위해 런타임에서 사용하지 않습니다. 추후 별도 라우팅 정책이 정리되면 보조 검색으로 다시 연결합니다.'
  },
  {
    code: 'K8',
    label: '한국전력공사 사업소 정보',
    provider: '한국전력공사',
    area: 'civil_service',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'service_key_required',
    usedFor: ['관할 사업소 안내', '주소/대표번호/업무 안내'],
    mvpBoundary: '주소 기반 관할 사업소 자동 매칭은 API endpoint와 주소 정규화가 필요합니다.'
  },
  {
    code: 'K9',
    label: '한국전력공사 요금청구방식 변동추이',
    provider: '한국전력공사',
    area: 'civil_service',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'service_key_required',
    usedFor: ['자동이체/모바일 청구 방식 안내', '청구 방식 통계'],
    mvpBoundary: '실제 자동이체 등록/변경은 인증 또는 공식 연계가 필요합니다.'
  },
  {
    code: 'L1',
    label: '카카오 로컬 API',
    provider: '카카오',
    area: 'location',
    sourceUrl: 'https://developers.kakao.com/docs/ko/local/dev-guide',
    auth: 'service_key',
    credentialNames: ['KAKAO_REST_API_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['장소명/주소를 위도·경도로 변환', 'EV 충전소 주변 검색 기준점 생성', '행정구역 보조 판정'],
    mvpBoundary: 'MCP가 사용자의 GPS를 직접 읽는 것은 아니며, 사용자가 입력한 장소명/주소를 좌표로 변환합니다.'
  },
  {
    code: 'L2',
    label: '카카오모빌리티 길찾기 API',
    provider: '카카오모빌리티',
    area: 'location',
    sourceUrl: 'https://developers.kakaomobility.com/guide/navi-api/directions',
    auth: 'service_key',
    credentialNames: ['KAKAO_REST_API_KEY', 'KAKAO_MOBILITY_REST_API_KEY'],
    runtimeStatus: 'service_key_required',
    usedFor: ['도로 기준 거리/도착시간 계산', 'EV 충전소 방문 플랜 고도화'],
    mvpBoundary: '현재는 직선거리/사용가능 상태 기반이며, 실제 도로 ETA는 길찾기 API 연결 시 고도화됩니다.'
  },
  {
    code: 'EV3',
    label: '한국환경공단 전기자동차 충전소 정보 API',
    provider: '한국환경공단',
    area: 'ev_charging',
    sourceUrl: 'https://www.data.go.kr/data/15076352/openapi.do',
    auth: 'service_key',
    credentialNames: ['EV_CHARGER_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['zcode 기반 충전소 정보 조회', '충전기 타입', '현재 상태 병합', '좌표/거리 기반 내부 후보 랭킹'],
    mvpBoundary: '공공 API는 주소/좌표 직접 검색이 아니라 지역코드 기반 조회입니다. MCP가 카카오 위치 API로 좌표를 잡고, 조회 결과를 거리/커넥터/출력 조건으로 내부 필터링합니다. 실제 예약 확정은 충전사업자 연계가 필요합니다.'
  },
  {
    code: 'W1',
    label: '기상청 단기예보 조회서비스',
    provider: '기상청',
    area: 'weather',
    sourceUrl: 'https://www.data.go.kr/data/15084084/openapi.do',
    auth: 'service_key',
    credentialNames: ['KMA_SHORT_FORECAST_SERVICE_KEY', 'KMA_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['초단기실황/예보', '냉방비/난방비 위험 안내', '피크 시간대 안내'],
    mvpBoundary: '격자 좌표(nx, ny) 또는 위치 변환이 필요합니다.'
  },
  {
    code: 'W3',
    label: '기상청 기상특보/영향예보',
    provider: '기상청',
    area: 'weather',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KMA_SHORT_FORECAST_SERVICE_KEY', 'KMA_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    runtimeStatus: 'service_key_required',
    usedFor: ['폭염/한파/호우/태풍 위험 안내', '전기설비 주의사항'],
    mvpBoundary: '특보 API endpoint 매핑 전에는 사용자가 입력한 특보/기온 정보만 반영합니다.'
  },
  {
    code: 'S1',
    label: '한국전력공사 신재생 에너지 현황',
    provider: '한국전력공사',
    area: 'solar',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['지역별 신재생 설비 현황', '태양광 보급 수준 비교'],
    mvpBoundary: '지역 통계 기반 안내이며 개별 부지 수익성 판단은 별도 데이터가 필요합니다.'
  },
  {
    code: 'S2',
    label: '한국전력공사 분산전원연계정보',
    provider: '한국전력공사',
    area: 'solar',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KEPCO_BIGDATA_API_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['선로 여유용량', '계통연계 가능성 안내'],
    mvpBoundary: '최종 접속 가능 여부는 한전 검토/신청 절차가 필요합니다.'
  },
  {
    code: 'S3',
    label: '한국전력거래소 지역별 시간별 태양광 발전량 정보',
    provider: '한국전력거래소',
    area: 'solar',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KPX_REGIONAL_SOLAR_HOURLY_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    runtimeStatus: 'service_key_required',
    usedFor: ['위치/시간 기반 태양광 발전량 예측', '전기요금 절감액 추정'],
    mvpBoundary: '서비스키와 정확한 endpoint 매핑 전에는 사용자가 제공한 일발전량/일사량 기준으로만 계산합니다.'
  },
  {
    code: 'S4',
    label: '기상청 단기예보 조회서비스',
    provider: '기상청',
    area: 'solar',
    sourceUrl: 'https://www.data.go.kr/',
    auth: 'service_key',
    credentialNames: ['KMA_SHORT_FORECAST_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    runtimeStatus: 'service_key_required',
    usedFor: ['실시간 일사량', '태양광 입지 간단 진단'],
    mvpBoundary: '기상/일사량 데이터는 지역 또는 좌표 입력이 필요합니다.'
  },
  {
    code: 'P1',
    label: '한국전력거래소 계통한계가격 및 수요예측(하루전 발전계획용)',
    provider: '한국전력거래소',
    area: 'power_grid',
    sourceUrl: 'https://www.data.go.kr/data/15131225/openapi.do',
    auth: 'service_key',
    credentialNames: ['KPX_SMP_DEMAND_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['SMP 기반 발전 판매 수익 추정', '전력수요 참고'],
    mvpBoundary: '공공 시장가격 참고용이며 실제 정산/계약 가격은 계약조건과 시장 규칙 확인이 필요합니다.'
  },
  {
    code: 'P2',
    label: '한국전력거래소 REC 현물시장 정보',
    provider: '한국전력거래소',
    area: 'power_grid',
    sourceUrl: 'https://www.data.go.kr/data/15099762/openapi.do',
    auth: 'service_key',
    credentialNames: ['KPX_REC_SPOT_SERVICE_KEY', 'DATA_GO_KR_SERVICE_KEY'],
    runtimeStatus: 'implemented',
    usedFor: ['REC 가격/거래량 기반 신재생 판매 수익 추정'],
    mvpBoundary: 'REC 실제 수익은 설비별 가중치, 계약방식, 거래시점에 따라 달라집니다.'
  }
];

export const FEATURE_API_CODES: Record<string, string[]> = {
  electric_bill: ['K1'],
  compare_home_usage: ['K2', 'K3', 'K4'],
  civil_service: ['K6', 'K7', 'K8', 'K9'],
  ev_charging: ['L1', 'L2', 'EV3'],
  weather_power_advisor: ['W1', 'W3', 'K1'],
  solar_region_checker: ['L1', 'S1', 'S2', 'S3', 'S4', 'K1'],
  renewable_sale: ['L1', 'S1', 'S2', 'P1', 'P2'],
  power_grid_status: ['P1', 'P2']
};

export function getPublicApis(input: { area?: PublicApiArea; feature?: string; codes?: string[] } = {}): PublicApiDefinition[] {
  let apis = PUBLIC_API_CATALOG;
  if (input.feature) {
    const codes = new Set(FEATURE_API_CODES[input.feature] ?? []);
    apis = apis.filter((api) => codes.has(api.code));
  }
  if (input.area) {
    apis = apis.filter((api) => api.area === input.area);
  }
  if (input.codes?.length) {
    const codes = new Set(input.codes);
    apis = apis.filter((api) => codes.has(api.code));
  }
  return apis;
}

export function getApiReadiness(input: { area?: PublicApiArea; feature?: string } = {}): ApiReadiness[] {
  return getPublicApis(input).map((api) => {
    const alternatives = api.credentialNames;
    const credentialReady = alternatives.length === 0 || alternatives.some((name) => Boolean(getContestCredential(name)));
    const ready = api.runtimeStatus === 'implemented' ? credentialReady : api.runtimeStatus === 'catalog_only';
    return {
      code: api.code,
      label: api.label,
      area: api.area,
      runtimeStatus: api.runtimeStatus,
      ready,
      missingCredentialNames: credentialReady ? [] : alternatives,
      mvpBoundary: api.mvpBoundary
    };
  });
}

export function getConfiguredServiceKey(names: string[]): string | undefined {
  for (const name of names) {
    const value = getContestCredential(name);
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function buildUnavailableApiMessage(feature: string, codes: string[]): string {
  const labels = getPublicApis({ codes }).map((api) => `${api.code} ${api.label}`).join(', ');
  return `${feature} 기능은 공공 API 우선 구조로 설계되어 있습니다. 현재 필요한 API 키나 endpoint가 없어 임의 데이터 없이 조회 불가로 반환합니다. 필요 API: ${labels}`;
}
