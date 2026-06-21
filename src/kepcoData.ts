export const SERVICE_NAME = 'kepco-electric-agent-mcp';
export const SERVICE_NAME_KO = '한전 전기생활 도우미';
export const SERVICE_VERSION = '0.3.3';

export type VoltageType = 'low_voltage' | 'high_voltage';
export type Season = 'summer' | 'other';
export type IntegrationBoundary = 'available_now' | 'needs_user_auth_or_api' | 'needs_partner_agreement';

export type CivilServiceType =
  | 'name_change'
  | 'move_settlement'
  | 'new_connection'
  | 'contract_change'
  | 'auto_payment'
  | 'bill_delivery'
  | 'welfare_discount'
  | 'outage_or_danger_report'
  | 'customer_number_lookup'
  | 'bill_lookup_or_payment'
  | 'ev_charger_usage_submission'
  | 'certificate_or_tax'
  | 'metering_or_due_date'
  | 'ppa_or_offset'
  | 'other'
  | 'unknown';

export interface ResidentialTariffBlock {
  upToKwh?: number;
  basicWon: number;
  rateWonPerKwh: number;
}

export interface ResidentialTariff {
  voltageType: VoltageType;
  season: Season;
  basisDate: string;
  sourceLabel: string;
  sourceUrl: string;
  climateEnvironmentWonPerKwh: number;
  fuelAdjustmentWonPerKwh: number;
  vatRate: number;
  powerIndustryFundRate: number;
  blocks: ResidentialTariffBlock[];
  notes: string[];
}

export interface OfficialDataSource {
  id: string;
  label: string;
  url: string;
  sourceType: 'official_page' | 'public_data' | 'public_api' | 'standard';
  usedFor: string[];
  mvpUse: string;
  limitation?: string;
}

export interface KepcoCivilServiceItem {
  code: string;
  labelKo: string;
  category: string;
  serviceType: CivilServiceType;
  boundary: IntegrationBoundary;
  officialPath: string;
  summary: string;
  keywords: string[];
  requiredInputs: string[];
  likelyDocuments: string[];
  mcpAction: string;
}

const OTHER_LOW: ResidentialTariffBlock[] = [
  { upToKwh: 200, basicWon: 910, rateWonPerKwh: 120.0 },
  { upToKwh: 400, basicWon: 1600, rateWonPerKwh: 214.6 },
  { basicWon: 7300, rateWonPerKwh: 307.3 }
];

const OTHER_HIGH: ResidentialTariffBlock[] = [
  { upToKwh: 200, basicWon: 730, rateWonPerKwh: 105.0 },
  { upToKwh: 400, basicWon: 1260, rateWonPerKwh: 174.0 },
  { basicWon: 6060, rateWonPerKwh: 242.3 }
];

const SUMMER_LOW: ResidentialTariffBlock[] = [
  { upToKwh: 300, basicWon: 910, rateWonPerKwh: 120.0 },
  { upToKwh: 450, basicWon: 1600, rateWonPerKwh: 214.6 },
  { basicWon: 7300, rateWonPerKwh: 307.3 }
];

const SUMMER_HIGH: ResidentialTariffBlock[] = [
  { upToKwh: 300, basicWon: 730, rateWonPerKwh: 105.0 },
  { upToKwh: 450, basicWon: 1260, rateWonPerKwh: 174.0 },
  { basicWon: 6060, rateWonPerKwh: 242.3 }
];

export function getResidentialTariff(voltageType: VoltageType, season: Season): ResidentialTariff {
  const blocks =
    voltageType === 'low_voltage'
      ? season === 'summer'
        ? SUMMER_LOW
        : OTHER_LOW
      : season === 'summer'
        ? SUMMER_HIGH
        : OTHER_HIGH;

  return {
    voltageType,
    season,
    basisDate: '2024-07-01',
    sourceLabel: 'KEPCO residential electricity tariff and KEPCO ON calculator basis',
    sourceUrl: 'https://online.kepco.co.kr/PRM004D00',
    climateEnvironmentWonPerKwh: 9,
    fuelAdjustmentWonPerKwh: 5,
    vatRate: 0.1,
    powerIndustryFundRate: 0.027,
    blocks,
    notes: [
      '주택용 전기요금 간이 추정입니다. 실제 청구액은 복지할인, 대가족/생명유지장치 할인, TV수신료, 검침일, 공동주택 계약 방식에 따라 달라질 수 있습니다.',
      '기후환경요금과 연료비조정단가는 변동될 수 있어 운영 시 공식 요금표 또는 환경변수로 갱신해야 합니다.',
      '청구금액은 전기요금계, 부가가치세, 전력산업기반기금을 더한 뒤 10원 미만 절사 기준으로 표시합니다.',
      '여름철 구간은 7~8월 주택용 누진구간 완화 기준으로 계산합니다.'
    ]
  };
}

export const OFFICIAL_DATA_SOURCES: OfficialDataSource[] = [
  {
    id: 'kepco_on_calculator',
    label: '한전ON 전기요금계산/비교',
    url: 'https://online.kepco.co.kr/PRM033D00',
    sourceType: 'official_page',
    usedFor: ['요금 계산 검증', '계약종별 계산 화면 확인'],
    mvpUse: '샘플 계산 결과를 MCP 계산 결과와 비교하는 검증 기준'
  },
  {
    id: 'kepco_tariff_table',
    label: '한전ON 전기요금표',
    url: 'https://online.kepco.co.kr/PRM004D00',
    sourceType: 'official_page',
    usedFor: ['요금표', '전기요금 구조', '부가가치세', '전력산업기반기금'],
    mvpUse: '주택용 요금 계산 로직의 공식 근거'
  },
  {
    id: 'data_go_kr_residential_tariff',
    label: '한국전력공사_주택용 전기요금표',
    url: 'https://www.data.go.kr/data/15090700/fileData.do',
    sourceType: 'public_data',
    usedFor: ['주택용 저압/고압 기본요금', '전력량요금', '누진구간'],
    mvpUse: '내장 요금표의 출처 문서',
    limitation: '파일 데이터이므로 운영 시 최신 파일을 내려받아 갱신해야 합니다.'
  },
  {
    id: 'data_go_kr_yearly_tariff',
    label: '한국전력공사_연도별 전기요금표',
    url: 'https://www.data.go.kr/data/15090576/fileData.do',
    sourceType: 'public_data',
    usedFor: ['연도별 요금 변경 이력', '계약종별 요금표'],
    mvpUse: '요금 데이터 갱신 근거'
  },
  {
    id: 'kepco_on_faq',
    label: '한국전력공사_한전ON 자주묻는 질문답변(FAQ)',
    url: 'https://www.data.go.kr/data/3068685/fileData.do',
    sourceType: 'public_data',
    usedFor: ['민원 안내', 'FAQ 검색', '업무분류'],
    mvpUse: '민원/업무 안내 답변 근거',
    limitation: '상세 답변은 한전ON 원문 확인이 필요할 수 있습니다.'
  },
  {
    id: 'kepco_on_civil_services',
    label: '한전ON 민원신청 63건',
    url: 'https://online.kepco.co.kr/MIM001D00',
    sourceType: 'official_page',
    usedFor: ['민원 63건 분류', '공식 메뉴 경로 안내'],
    mvpUse: '자연어 민원 분류 카탈로그'
  },
  {
    id: 'kepco_on_forms',
    label: '한전ON 서식자료실',
    url: 'https://online.kepco.co.kr/CUM083D00',
    sourceType: 'official_page',
    usedFor: ['공식 신청서/위임장/첨부서식 확인', '서식 다운로드 경로 안내'],
    mvpUse: '민원 초안 작성 시 공식 서식 위치와 제출 전 확인 경로 안내',
    limitation: 'PlayMCP MVP에서는 파일을 직접 생성/다운로드시키기보다 공식 URL과 작성 초안을 제공합니다.'
  },
  {
    id: 'kepco_on_new_connection',
    label: '한전ON 전기사용신청(신규) 안내',
    url: 'https://online.kepco.co.kr/MIM028D00',
    sourceType: 'official_page',
    usedFor: ['전기사용신청 제출서류', '서식다운로드 경로', '신규 신청 안내'],
    mvpUse: '신규 전기사용신청 작성 항목과 제출 전 체크리스트 안내',
    limitation: '최종 접수는 한전ON 로그인/본인확인 또는 공식 API 권한이 필요합니다.'
  },
  {
    id: 'kepco_on_contract_change',
    label: '한전ON 전기사용 변경(증설등) 안내',
    url: 'https://online.kepco.co.kr/MIM043D00',
    sourceType: 'official_page',
    usedFor: ['계약전력 변경/증설 안내', '제출서류', '공식 신청 경로'],
    mvpUse: '증설/계약변경 민원 초안과 필요 정보 안내',
    limitation: '최종 제출은 한전ON 인증 절차 또는 KEPCO 연계 API가 필요합니다.'
  },
  {
    id: 'kepco_power_use_application_receipt',
    label: '전기사용신청 접수서 예시',
    url: 'https://home.kepco.co.kr/kepco/front/html/CY/F/A/CYFAPP0018103.pop3.html',
    sourceType: 'official_page',
    usedFor: ['전기사용신청 접수서 항목 확인', '신청서 작성 초안 근거'],
    mvpUse: '자연어 입력을 공식 양식 항목에 맞춰 정리하는 근거'
  },
  {
    id: 'keco_ev_charger_api',
    label: '한국환경공단 전기자동차 충전소 정보 API',
    url: 'https://www.data.go.kr/data/15076352/openapi.do',
    sourceType: 'public_api',
    usedFor: ['충전소 위치', '충전기 타입', '현재 상태', '상태 갱신시각'],
    mvpUse: 'EV 충전 방문 플랜의 실시간 상태 데이터',
    limitation: '운영 환경에서는 공공데이터포털 서비스키가 필요합니다.'
  },
  {
    id: 'ex_rest_area_charger_data',
    label: '한국도로공사 휴게소 전기차/수소차 충전소 현황',
    url: 'https://www.data.go.kr/data/15085543/fileData.do',
    sourceType: 'public_data',
    usedFor: ['고속도로 휴게소 충전소 후보', '노선/방향 기반 추천'],
    mvpUse: '경로상 충전소 후보군 구성'
  },
  {
    id: 'ocpp_standard',
    label: 'Open Charge Point Protocol (OCPP)',
    url: 'https://openchargealliance.org/protocols/open-charge-point-protocol/',
    sourceType: 'standard',
    usedFor: ['충전소 예약 확정 기능의 기술적 전제', '충전기-관제시스템 통신'],
    mvpUse: '실제 예약 확정은 충전사업자 관제 API/OCPP 연계가 필요하다는 경계 설명'
  }
];

export function getOfficialDataSourcesResult(): {
  total: number;
  sources: OfficialDataSource[];
  markdownSummary: string;
  useNote: string;
  fileReturnNote: string;
} {
  const visibleSources = getUserVisibleOfficialDataSources();
  return {
    total: visibleSources.length,
    sources: visibleSources,
    markdownSummary: visibleSources.map((source) => {
      const usedFor = source.usedFor.join(', ');
      const limitation = source.limitation ? ` 제한: ${source.limitation}` : '';
      return `- [${source.label}](${source.url}) (${source.sourceType}) - 사용처: ${usedFor}. MVP: ${source.mvpUse}.${limitation}`;
    }).join('\n'),
    useNote:
      '요금 계산, 민원 분류, 서식 안내, EV 충전 방문 플랜은 공식 페이지/공공데이터를 근거로 하되, 로그인·본인확인·결제·예약 확정은 별도 인증/API 연계가 필요합니다.',
    fileReturnNote:
      'MCP 표준은 resource link/embedded resource 형태의 파일성 응답을 지원하지만, 현재 PlayMCP 화면에서 다운로드 UX가 어떻게 노출되는지는 별도 검증이 필요합니다. MVP는 공식 URL, 작성 항목, 마크다운 초안 반환을 기본으로 둡니다.'
  };
}

export function getUserVisibleOfficialDataSources(): OfficialDataSource[] {
  return OFFICIAL_DATA_SOURCES.filter((source) => source.id !== 'ocpp_standard');
}

export const APPLIANCE_PRESETS: Array<{
  aliases: string[];
  applianceName: string;
  typicalPowerW: number;
  note: string;
}> = [
  {
    aliases: ['에어컨', '벽걸이 에어컨', '스탠드 에어컨', '냉방'],
    applianceName: '에어컨',
    typicalPowerW: 1500,
    note: '인버터 에어컨은 실사용 평균 소비전력이 정격보다 낮을 수 있어 제품 표시 소비전력 또는 스마트플러그 측정값이 있으면 더 정확합니다.'
  },
  {
    aliases: ['제습기'],
    applianceName: '제습기',
    typicalPowerW: 300,
    note: '제습기는 습도와 압축기 동작률에 따라 실제 평균 소비전력이 변합니다.'
  },
  {
    aliases: ['건조기', '의류건조기'],
    applianceName: '의류건조기',
    typicalPowerW: 1200,
    note: '히트펌프/히터식 여부와 코스에 따라 1회 사용 전력량 차이가 큽니다.'
  },
  {
    aliases: ['전기히터', '히터', '난방기'],
    applianceName: '전기히터',
    typicalPowerW: 2000,
    note: '전기히터는 정격 소비전력에 가깝게 오래 동작하는 편이라 요금 증가가 큽니다.'
  },
  {
    aliases: ['전기장판', '온수매트'],
    applianceName: '전기장판/온수매트',
    typicalPowerW: 200,
    note: '온도 단계와 실내 단열에 따라 평균 소비전력이 낮아질 수 있습니다.'
  },
  {
    aliases: ['컴퓨터', 'pc', 'PC', '데스크탑'],
    applianceName: '데스크탑 PC',
    typicalPowerW: 400,
    note: '게임/렌더링 등 고부하 작업에서는 소비전력이 더 올라갑니다.'
  },
  {
    aliases: ['전기차', 'ev', 'EV', '충전'],
    applianceName: '전기차 충전',
    typicalPowerW: 7000,
    note: '전기차 충전은 주택용이 아닌 전기자동차 충전전력 요금제가 적용될 수 있습니다.'
  }
];

function civilItem(
  code: string,
  labelKo: string,
  category: string,
  serviceType: CivilServiceType,
  boundary: IntegrationBoundary,
  summary: string,
  keywords: string[],
  requiredInputs: string[] = ['고객번호 또는 사용장소 주소', '신청자 정보', '연락처'],
  likelyDocuments: string[] = ['한전ON 본인확인 후 민원별 추가서류 확인 필요']
): KepcoCivilServiceItem {
  return {
    code,
    labelKo,
    category,
    serviceType,
    boundary,
    officialPath: `한전ON > 민원신청 > ${category} > ${labelKo}`,
    summary,
    keywords: Array.from(new Set([labelKo, category, ...keywords])),
    requiredInputs,
    likelyDocuments,
    mcpAction:
      boundary === 'available_now'
        ? '공식 안내와 신고 초안을 정리할 수 있습니다.'
        : '민원 종류를 분류하고, 제출 전 입력값/서류/초안을 준비한 뒤 한전ON 인증 화면으로 넘깁니다.'
  };
}

export const CIVIL_SERVICE_ITEMS: KepcoCivilServiceItem[] = [
  civilItem('name_change', '명의변경', '명의변경/전기사용', 'name_change', 'needs_user_auth_or_api', '전기사용 계약 명의를 변경합니다.', ['계약자 변경', '사용자 변경', '이름 바꾸', '세입자', '임대차'], ['고객번호 또는 사용장소 주소', '현재/변경 후 명의자 정보', '변경 사유', '연락처'], ['명의자 확인자료', '임대차/매매 등 권원 확인자료가 요구될 수 있음']),
  civilItem('bill_delivery_type', '청구서유형 관리', '요금청구/납부/자동이체', 'bill_delivery', 'needs_user_auth_or_api', '모바일, 이메일, 우편 등 청구서 수령 방식을 관리합니다.', ['청구서 변경', '고지서', '이메일 청구', '모바일 청구']),
  civilItem('new_connection', '전기사용 신청(신규)', '명의변경/전기사용', 'new_connection', 'needs_user_auth_or_api', '신규 사용장소의 전기사용을 신청합니다.', ['신규 전기', '전기 신설', '입주 전기', '사업장 전기'], ['사용장소 주소', '신청자 정보', '계약전력', '사용 용도', '사용 개시 희망일'], ['전기사용신청서', '사용장소/소유/사용권원 자료', '전기공사업체 관련 자료']),
  civilItem('move_settlement', '이사정산', '이사정산', 'move_settlement', 'needs_user_auth_or_api', '이사 시점 전기사용량과 요금을 정산합니다.', ['이사 정산', '전출', '전입', '퇴거', '계량기 지침'], ['고객번호 또는 주소', '이사일', '계량기 지침', '연락처'], ['계량기 지침 사진']),
  civilItem('contract_change', '전기사용 변경(증설등)', '명의변경/전기사용', 'contract_change', 'needs_user_auth_or_api', '계약전력 증설, 계약종별 등 사용 조건을 변경합니다.', ['증설', '감소', '계약전력', '용량 변경', '종별 변경'], ['고객번호 또는 주소', '현재/변경 희망 계약전력', '변경 사유'], ['부하설비 내역', '공사업체 자료가 요구될 수 있음']),
  civilItem('welfare_discount', '복지할인', '복지할인', 'welfare_discount', 'needs_user_auth_or_api', '복지할인 대상자의 전기요금 할인 신청을 처리합니다.', ['장애인 할인', '국가유공자', '기초생활', '차상위', '대가족', '생명유지'], ['고객번호', '할인 대상 유형', '대상자 정보'], ['대상자 증빙 또는 행정정보 공동이용 동의']),
  civilItem('apt_unit_usage_submit', '고압아파트(오피스텔) 호별 사용량 제출', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '고압아파트/오피스텔 호별 사용량을 제출합니다.', ['아파트 사용량', '호별 사용량', '오피스텔 사용량']),
  civilItem('certificate_issue', '증명서 발행', '세금계산서 및 증명서', 'certificate_or_tax', 'needs_user_auth_or_api', '납부/사용 관련 증명서를 발행합니다.', ['증명서', '납부증명', '사용증명']),
  civilItem('new_connection_status', '전기사용신청 처리현황 조회', '명의변경/전기사용', 'new_connection', 'needs_user_auth_or_api', '전기사용신청 진행 상태를 조회합니다.', ['처리현황', '진행상태', '신청 상태']),
  civilItem('switch_operation', '개폐기(책임한계점) 조작 요청', '전기설비', 'contract_change', 'needs_user_auth_or_api', '책임한계점 개폐기 조작을 요청합니다.', ['개폐기', '책임한계점', '스위치 조작']),
  civilItem('tax_invoice_reissue', '세금계산서 재발행', '세금계산서 및 증명서', 'certificate_or_tax', 'needs_user_auth_or_api', '전기요금 세금계산서를 재발행합니다.', ['세금계산서', '재발행', '계산서']),
  civilItem('power_fund_exemption', '전력산업기반기금면제 신청', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '요건에 따른 전력산업기반기금 면제를 신청합니다.', ['전력산업기반기금', '기금 면제']),
  civilItem('contract_termination', '계약 해지', '명의변경/전기사용', 'contract_change', 'needs_user_auth_or_api', '전기사용 계약을 해지합니다.', ['계약 해지', '전기 해지', '사용 중지']),
  civilItem('business_registration_change', '사업자등록 변경', '명의변경/전기사용', 'contract_change', 'needs_user_auth_or_api', '전기사용 고객의 사업자등록 정보를 변경합니다.', ['사업자등록', '사업자 변경']),
  civilItem('deposit_inactive_lookup', '휴면 고객보증금 조회', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '휴면 고객보증금 대상 금액을 조회합니다.', ['보증금', '휴면', '고객보증금']),
  civilItem('double_payment_refund_lookup', '전기요금 이중수납금 환불 대상금액 조회', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '이중수납 환불 대상 금액을 조회합니다.', ['이중수납', '환불', '중복납부']),
  civilItem('integrated_billing_customer_number', '통합청구 고객번호 등록/해지', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '통합청구용 고객번호를 등록하거나 해지합니다.', ['통합청구', '고객번호 등록', '고객번호 해지']),
  civilItem('suspension_request', '휴지 신청', '명의변경/전기사용', 'contract_change', 'needs_user_auth_or_api', '일정 기간 전기사용 휴지를 신청합니다.', ['휴지', '일시중지', '사용정지']),
  civilItem('multi_household', '1주택 수가구 신청/변경', '복지할인', 'welfare_discount', 'needs_user_auth_or_api', '1주택 수가구 요금 적용을 신청/변경합니다.', ['1주택', '수가구', '여러 가구']),
  civilItem('meter_reading_day_change', '검침일 변경', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '전기 검침일 변경을 신청합니다.', ['검침일', '검침 날짜']),
  civilItem('self_meter_reading', '자가검침 지침입력', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '자가검침 계량기 지침을 입력합니다.', ['자가검침', '지침입력', '계량기 숫자']),
  civilItem('outage_report', '전기고장 신고', '전기설비', 'outage_or_danger_report', 'available_now', '정전, 위험설비, 전기고장 상황을 신고합니다.', ['정전', '전기고장', '스파크', '전선', '전주', '감전'], ['발생 위치', '상황 설명', '발견 시각', '연락처'], ['현장 사진 가능 시 첨부']),
  civilItem('due_date_tax_invoice_reissue', '납기일선택제 고객 세금계산서 재발행', '세금계산서 및 증명서', 'certificate_or_tax', 'needs_user_auth_or_api', '납기일선택제 고객의 세금계산서를 재발행합니다.', ['납기일선택제', '세금계산서 재발행']),
  civilItem('due_date_choice', '납기일선택제 신청', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '요금 납기일 선택을 신청합니다.', ['납기일 선택', '납부일 변경']),
  civilItem('facility_charge_tax_invoice', '시설부담금 세금계산서 발행', '세금계산서 및 증명서', 'certificate_or_tax', 'needs_user_auth_or_api', '시설부담금 세금계산서를 발행합니다.', ['시설부담금', '세금계산서']),
  civilItem('pole_relocation', '지장전주 이설', '전기설비', 'contract_change', 'needs_user_auth_or_api', '공사/건축 등에 지장이 되는 전주 이설을 신청합니다.', ['지장전주', '전주 이설', '전봇대 이동']),
  civilItem('small_regular_bill_change', '소액 상시청구 변경', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '소액 상시청구 관련 변경을 신청합니다.', ['소액 상시청구']),
  civilItem('service_line_maintenance', '인입선 정비 및 변경 신청', '전기설비', 'contract_change', 'needs_user_auth_or_api', '인입선 정비 또는 변경을 신청합니다.', ['인입선', '정비', '인입선 변경']),
  civilItem('offset_new', '요금상계거래 신청(신규)', 'PPA/상계거래', 'ppa_or_offset', 'needs_user_auth_or_api', '요금상계거래 신규 신청을 진행합니다.', ['상계거래', '요금상계', '태양광']),
  civilItem('apt_move_report', '이사신고(종합아파트)', '이사정산', 'move_settlement', 'needs_user_auth_or_api', '종합아파트 이사신고를 처리합니다.', ['아파트 이사', '종합아파트']),
  civilItem('payment_certificate_verify', '요금납부증명서 진위확인', '세금계산서 및 증명서', 'certificate_or_tax', 'available_now', '요금납부증명서 진위를 확인합니다.', ['진위확인', '납부증명서']),
  civilItem('meter_inspection_exchange', '전력량계 점검 및 교환신청', '전기설비', 'metering_or_due_date', 'needs_user_auth_or_api', '전력량계 점검 또는 교환을 신청합니다.', ['전력량계', '계량기 점검', '계량기 교환']),
  civilItem('reuse_after_termination', '해지 후 재사용', '명의변경/전기사용', 'new_connection', 'needs_user_auth_or_api', '해지된 전기사용 계약의 재사용을 신청합니다.', ['해지 후 재사용', '재사용']),
  civilItem('cash_deposit_balance', '현금보증금 예치내역 및 잔액 조회', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '현금보증금 예치내역과 잔액을 조회합니다.', ['현금보증금', '예치내역', '잔액']),
  civilItem('self_metering_apply_cancel', '자가검침 신청/해지', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '자가검침 신청 또는 해지를 처리합니다.', ['자가검침 신청', '자가검침 해지']),
  civilItem('due_date_customer_change', '납기일 선택제 고객 등록/변경', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '납기일 선택제 고객 등록/변경을 처리합니다.', ['납기일 선택제', '고객 등록']),
  civilItem('ppa_customer', 'PPA 고객 신청', 'PPA/상계거래', 'ppa_or_offset', 'needs_user_auth_or_api', 'PPA 고객 신청을 처리합니다.', ['PPA', '전력구매계약']),
  civilItem('apt_unit_lookup', '고압아파트(오피스텔) 세대내역 조회', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '고압아파트/오피스텔 세대내역을 조회합니다.', ['세대내역', '고압아파트 조회']),
  civilItem('facility_charge_cash_receipt_lookup', '시설부담금 현금영수증발행 조회', '세금계산서 및 증명서', 'certificate_or_tax', 'needs_user_auth_or_api', '시설부담금 현금영수증 발행 내역을 조회합니다.', ['시설부담금', '현금영수증']),
  civilItem('facility_charge_refund_lookup', '시설부담금 환불 대상금액 조회', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '시설부담금 환불 대상 금액을 조회합니다.', ['시설부담금 환불']),
  civilItem('planned_use_notice', '전기사용예정통지 신청', '명의변경/전기사용', 'new_connection', 'needs_user_auth_or_api', '전기사용예정통지를 신청합니다.', ['사용예정통지', '예정통지']),
  civilItem('cash_deposit_bill_lookup', '현금보증금 청구서 조회', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '현금보증금 청구서를 조회합니다.', ['현금보증금 청구서']),
  civilItem('reuse_after_suspension', '휴지 후 재사용', '명의변경/전기사용', 'new_connection', 'needs_user_auth_or_api', '휴지 상태의 전기사용 재사용을 신청합니다.', ['휴지 후 재사용']),
  civilItem('integrated_tax_invoice_reissue', '통합청구 고객 세금계산서 재발행', '세금계산서 및 증명서', 'certificate_or_tax', 'needs_user_auth_or_api', '통합청구 고객의 세금계산서를 재발행합니다.', ['통합청구', '세금계산서 재발행']),
  civilItem('ami_apply', '원격검침(AMI)신청', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '원격검침(AMI)을 신청합니다.', ['원격검침', 'AMI']),
  civilItem('welfare_certificate_verify', '복지할인 확인증 진위확인', '복지할인', 'welfare_discount', 'available_now', '복지할인 확인증 진위를 확인합니다.', ['복지할인 확인증', '진위확인']),
  civilItem('ev_charger_usage_submit', '전기차충전소 사용량 제출', '검침 및 납기일', 'ev_charger_usage_submission', 'needs_user_auth_or_api', '전기차충전소 사용량을 제출합니다.', ['전기차충전소 사용량', '충전소 사용량 제출']),
  civilItem('offset_increase', '요금상계거래 신청(증설)', 'PPA/상계거래', 'ppa_or_offset', 'needs_user_auth_or_api', '요금상계거래 증설 신청을 처리합니다.', ['상계거래 증설']),
  civilItem('jeju_residential_tou', '(제주지역) 주택용 저압 요금제 (변경) 신청', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '제주지역 주택용 저압 선택요금제 변경을 신청합니다.', ['제주', '주택용 저압', '요금제 변경']),
  civilItem('offset_change', '요금상계거래 변경', 'PPA/상계거래', 'ppa_or_offset', 'needs_user_auth_or_api', '요금상계거래 내용을 변경합니다.', ['상계거래 변경']),
  civilItem('integrated_account_new', '통합청구 계정 신규 생성', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '통합청구 계정을 새로 생성합니다.', ['통합청구 계정']),
  civilItem('penalty_reception', '전기위약 접수', '기타', 'other', 'needs_user_auth_or_api', '전기위약 관련 접수를 처리합니다.', ['전기위약', '위약']),
  civilItem('field_consulting', '현장컨설팅 신청', '기타', 'other', 'needs_user_auth_or_api', '현장컨설팅을 신청합니다.', ['현장컨설팅', '컨설팅']),
  civilItem('energy_cashback_lookup', '에너지캐시백 조회', '기타', 'other', 'needs_user_auth_or_api', '에너지캐시백 참여/조회 관련 정보를 확인합니다.', ['에너지캐시백', '캐시백']),
  civilItem('offset_reuse_after_cancel', '요금상계거래 신청(해지후재사용)', 'PPA/상계거래', 'ppa_or_offset', 'needs_user_auth_or_api', '해지 후 재사용 요금상계거래 신청을 처리합니다.', ['상계거래 해지후재사용']),
  civilItem('jeju_apt_tou', '(제주지역) 아파트 계시별 선택요금 신청', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '제주지역 아파트 계시별 선택요금을 신청합니다.', ['제주', '아파트', '계시별', '선택요금']),
  civilItem('jeju_apt_tou_usage', '(제주지역) 아파트 TOU 사용량 제출', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '제주지역 아파트 TOU 사용량을 제출합니다.', ['제주', 'TOU', '사용량 제출']),
  civilItem('power_factor_notice', '역률요금 부과방법 개정안내', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'available_now', '역률요금 부과방법 개정 내용을 안내합니다.', ['역률요금', '부과방법']),
  civilItem('auto_payment', '전기요금 자동이체', '요금청구/납부/자동이체', 'auto_payment', 'needs_user_auth_or_api', '전기요금 자동이체를 신청/변경합니다.', ['자동이체', '계좌이체', '카드 자동납부'], ['고객번호', '납부자 정보', '계좌/카드 정보', '본인확인 정보'], ['계좌/카드 인증']),
  civilItem('corporate_document_simplification', '법인 서류간소화', '명의변경/전기사용', 'other', 'needs_user_auth_or_api', '법인 고객 서류 간소화 관련 업무를 처리합니다.', ['법인', '서류간소화']),
  civilItem('installment_payment', '전기요금 분할납부 신청', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '전기요금 분할납부를 신청합니다.', ['분할납부', '분납']),
  civilItem('apt_unit_contract_number', '아파트 세대계약번호 등록', '검침 및 납기일', 'metering_or_due_date', 'needs_user_auth_or_api', '아파트 세대계약번호를 등록합니다.', ['세대계약번호', '아파트 계약번호']),
  civilItem('credit_card_payment', '전기요금 신용카드 납부', '요금청구/납부/자동이체', 'bill_lookup_or_payment', 'needs_user_auth_or_api', '전기요금을 신용카드로 납부합니다.', ['신용카드 납부', '카드 납부'])
];

export const CIVIL_SERVICE_GUIDES: Record<
  CivilServiceType,
  {
    labelKo: string;
    description: string;
    kepcoOnPath: string;
    directUrl: string;
    requiredInputs: string[];
    likelyDocuments: string[];
    notes: string[];
  }
> = {
  name_change: {
    labelKo: '명의변경',
    description: '전기사용 계약 명의를 새 사용자로 변경하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 명의변경/전기사용 > 명의변경',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호 또는 사용장소 주소', '현재/변경 후 명의자 정보', '연락처', '변경 사유'],
    likelyDocuments: ['명의자 확인자료', '임대차/매매 등 권원 확인자료가 요구될 수 있음'],
    notes: ['본인확인과 개인정보 처리가 필요하므로 MCP가 대신 제출하지 않고 신청서 초안과 체크리스트를 제공합니다.']
  },
  move_settlement: {
    labelKo: '이사정산',
    description: '이사 시점의 전기사용량과 요금을 정산하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 이사정산',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호 또는 주소', '이사일', '계량기 지침', '연락처', '정산 대상자 정보'],
    likelyDocuments: ['계량기 지침 사진', '계약자 확인 정보'],
    notes: ['정산 금액 확정과 납부는 한전ON 인증 이후 진행해야 합니다.']
  },
  new_connection: {
    labelKo: '전기사용 신청(신규)',
    description: '신축/입주/사업장 개설 등 신규 전기사용을 신청하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 명의변경/전기사용 > 전기사용 신청(신규)',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['사용장소 주소', '신청자 정보', '사용 개시 희망일', '계약전력', '용도/업종', '연락처'],
    likelyDocuments: ['전기사용신청서', '사용장소/소유/사용권원 자료', '전기공사업체 관련 자료'],
    notes: ['계약전력/종별 판단이 핵심이므로 입력값을 구조화해 신청서 초안을 만듭니다.']
  },
  contract_change: {
    labelKo: '전기사용 변경(증설 등)',
    description: '계약전력, 계약종별, 공급방식 등 기존 전기사용 조건을 변경하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 명의변경/전기사용 > 전기사용 변경',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호 또는 주소', '현재 계약전력/종별', '변경 희망 계약전력/종별', '변경 사유', '희망일'],
    likelyDocuments: ['부하설비 내역', '전기공사업체 정보', '사업자등록증(사업장)'],
    notes: ['일부 변경은 현장 확인이나 공사비 산정이 필요할 수 있습니다.']
  },
  auto_payment: {
    labelKo: '자동이체 신청/변경',
    description: '전기요금 납부 계좌나 카드 자동이체를 신청/변경하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 요금청구/납부/자동이체 > 자동이체',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호', '납부자 정보', '계좌 또는 카드 정보', '본인확인 정보'],
    likelyDocuments: ['본인 인증 수단', '계좌/카드 인증'],
    notes: ['금융정보 전송이 필요하므로 실제 자동이체 등록은 MCP에서 수행하지 않습니다.']
  },
  bill_delivery: {
    labelKo: '청구서 변경',
    description: '모바일/이메일/우편 등 청구서 수령 방식을 변경하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 요금청구/납부/자동이체 > 청구서유형 관리',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호', '변경할 청구서 유형', '휴대폰 또는 이메일', '본인확인 정보'],
    likelyDocuments: ['본인 인증 수단'],
    notes: ['개인정보 확인 후 한전ON에서 최종 변경해야 합니다.']
  },
  welfare_discount: {
    labelKo: '복지할인 신청',
    description: '장애인, 국가유공자, 기초생활수급, 차상위, 대가족 등 전기요금 할인 신청 안내입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 복지할인',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호', '할인 대상 유형', '대상자 정보', '신청자와 대상자 관계', '연락처'],
    likelyDocuments: ['대상자 증빙 또는 행정정보 공동이용 동의', '가족관계 확인 자료가 요구될 수 있음'],
    notes: ['대상 유형별 요건이 달라 신청 전 조건 확인이 필요합니다.']
  },
  outage_or_danger_report: {
    labelKo: '전기고장/위험설비 신고',
    description: '정전, 전선 단선, 전주/변압기 위험, 감전 위험 등을 신고하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 전기고장/위험설비 신고 또는 고객센터 123',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['발생 위치', '상황 설명', '발견 시각', '신고자 연락처', '사진 가능 여부'],
    likelyDocuments: ['현장 사진(가능한 경우)'],
    notes: ['감전/화재/인명 위험이 있으면 한전ON 입력보다 119/123 등 즉시 신고가 우선입니다.']
  },
  customer_number_lookup: {
    labelKo: '고객번호 조회',
    description: '주소/명의자 정보로 전기사용 고객번호를 확인하는 절차입니다.',
    kepcoOnPath: '한전ON > 고객번호 조회',
    directUrl: 'https://online.kepco.co.kr/EXL100D00',
    requiredInputs: ['사용장소 주소', '명의자 성명', '생년월일 또는 사업자 정보', '본인확인 정보'],
    likelyDocuments: ['본인 인증 수단'],
    notes: ['개인정보 조회이므로 MCP는 조회 절차 안내까지만 수행합니다.']
  },
  bill_lookup_or_payment: {
    labelKo: '요금조회/납부',
    description: '전기요금 청구내역 조회 및 납부 관련 업무입니다.',
    kepcoOnPath: '한전ON > 요금조회/납부',
    directUrl: 'https://online.kepco.co.kr/MYM043D00',
    requiredInputs: ['고객번호', '명의자 정보', '납부 수단', '본인확인 정보'],
    likelyDocuments: ['본인 인증 수단', '납부 수단 인증'],
    notes: ['실제 납부는 결제/금융정보가 필요하므로 한전ON에서 최종 처리해야 합니다.']
  },
  ev_charger_usage_submission: {
    labelKo: '전기차충전소 사용량 제출',
    description: '전기차충전소 운영자가 사용량을 제출하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 검침 및 납기일 > 전기차충전소 사용량 제출',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호', '충전소/충전기 정보', '사용량', '제출자 정보'],
    likelyDocuments: ['충전소 사용량 자료', '사업자 또는 운영자 확인자료'],
    notes: ['전기차 충전소 예약과는 다른 한전 민원이며, 실제 제출은 한전ON 인증이 필요합니다.']
  },
  certificate_or_tax: {
    labelKo: '증명서/세금계산서',
    description: '요금납부증명서, 세금계산서 등 증명/세무 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 세금계산서 및 증명서',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호', '증명서 종류', '발급 대상 기간', '신청자 정보'],
    likelyDocuments: ['본인 인증 수단', '사업자 정보가 요구될 수 있음'],
    notes: ['발급/재발행은 한전ON 인증 이후 최종 처리해야 합니다.']
  },
  metering_or_due_date: {
    labelKo: '검침 및 납기일',
    description: '검침일, 자가검침, AMI, 납기일 관련 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 검침 및 납기일',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호', '계량기/검침 정보', '희망일', '연락처'],
    likelyDocuments: ['계량기 지침 사진 또는 현장 확인자료가 요구될 수 있음'],
    notes: ['고객별 검침 정보는 인증이 필요합니다.']
  },
  ppa_or_offset: {
    labelKo: 'PPA/상계거래',
    description: 'PPA 고객 또는 요금상계거래 신청/변경 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > PPA/상계거래',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호', '발전/상계거래 정보', '설비 정보', '신청자 정보'],
    likelyDocuments: ['발전설비 관련 자료', '계약/인허가 자료가 요구될 수 있음'],
    notes: ['설비/계약 조건 검토가 필요하므로 MCP는 준비자료 정리까지만 수행합니다.']
  },
  other: {
    labelKo: '기타 한전ON 민원',
    description: '현장컨설팅, 전기위약, 에너지캐시백 등 기타 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 기타',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호 또는 주소', '업무 내용', '신청자 정보', '연락처'],
    likelyDocuments: ['민원별 추가서류 확인 필요'],
    notes: ['업무 유형을 더 구체화하면 필요한 입력값을 좁힐 수 있습니다.']
  },
  unknown: {
    labelKo: '민원 유형 확인 필요',
    description: '입력만으로 정확한 한전ON 민원 유형을 확정하기 어렵습니다.',
    kepcoOnPath: '한전ON > 민원신청',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호 또는 주소', '하려는 업무', '희망 처리일', '연락처'],
    likelyDocuments: ['업무 유형 확정 후 안내 가능'],
    notes: ['자연어 내용을 더 구체화하면 민원 63건 중 하나로 분류할 수 있습니다.']
  }
};

export const OFFICIAL_LINKS = [
  {
    label: '한전ON',
    url: 'https://online.kepco.co.kr/',
    description: '전기요금 조회/납부, 전기요금 계산, 명의변경, 자동이체, 민원신청을 제공하는 대표 고객 플랫폼'
  },
  {
    label: '한전ON 전기요금계산/비교',
    url: 'https://online.kepco.co.kr/PRM033D00',
    description: '공식 전기요금 계산/비교 화면'
  },
  {
    label: '한전 전기요금표',
    url: 'https://online.kepco.co.kr/PRM004D00',
    description: '계약종별 전기요금표'
  },
  {
    label: '한전ON 민원신청 63건',
    url: 'https://online.kepco.co.kr/MIM001D00',
    description: '민원 63건 카탈로그와 공식 민원 메뉴'
  },
  {
    label: '한국환경공단 전기차 충전소 정보 API',
    url: 'https://www.data.go.kr/data/15076352/openapi.do',
    description: '전기차 충전소 위치/상태 공개 API'
  },
  {
    label: '한국도로공사 휴게소 충전소 현황',
    url: 'https://www.data.go.kr/data/15085543/fileData.do',
    description: '고속도로 휴게소 전기차/수소차 충전소 현황'
  }
];
