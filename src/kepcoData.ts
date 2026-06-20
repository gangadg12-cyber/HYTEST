export const SERVICE_NAME = 'kepco-electric-agent-mcp';
export const SERVICE_NAME_KO = '한전 전기사용 도우미';
export const SERVICE_VERSION = '0.2.0';

export type VoltageType = 'low_voltage' | 'high_voltage';
export type Season = 'summer' | 'other';
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
    sourceLabel: 'KEPCO residential electricity tariff',
    sourceUrl: 'https://online.kepco.co.kr/PRM004D00',
    climateEnvironmentWonPerKwh: 9,
    fuelAdjustmentWonPerKwh: 5,
    vatRate: 0.1,
    powerIndustryFundRate: 0.037,
    blocks,
    notes: [
      '주택용 전기요금 간이 추정입니다. 실제 청구액은 복지할인, 대가족/생명유지장치 할인, TV수신료, 검침일, 세부 부가금, 공동주택 계약 방식에 따라 달라질 수 있습니다.',
      '연료비조정단가와 기후환경요금 단가는 변동될 수 있어 운영 시 환경변수나 요금 DB로 갱신해야 합니다.',
      '여름철 구간은 7~8월 주택용 누진구간 완화 기준으로 계산합니다.'
    ]
  };
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
    likelyDocuments: ['저압 5kW 이하 등 일부 경우 별도 구비서류 없이 가능할 수 있음', '임대차/매매 등 권원 확인 자료가 요구될 수 있음'],
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
    likelyDocuments: ['건축물 관련 자료', '전기공사업체 정보', '사업자등록증(사업장)', '필요 시 사용전 점검 관련 서류'],
    notes: ['계약전력/종별 판단이 핵심이므로 입력값을 구조화해 신청서 초안을 만듭니다.']
  },
  contract_change: {
    labelKo: '전기사용 변경(증설 등)',
    description: '계약전력, 계약종별, 공급방식 등 기존 전기사용 조건을 변경하는 민원입니다.',
    kepcoOnPath: '한전ON > 민원신청 > 명의변경/전기사용 > 전기사용 변경',
    directUrl: 'https://online.kepco.co.kr/MIM043D00',
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
  unknown: {
    labelKo: '민원 유형 확인 필요',
    description: '입력만으로 정확한 한전ON 민원 유형을 확정하기 어렵습니다.',
    kepcoOnPath: '한전ON > 민원신청',
    directUrl: 'https://online.kepco.co.kr/MIM001D00',
    requiredInputs: ['고객번호 또는 주소', '하려는 업무', '희망 처리일', '연락처'],
    likelyDocuments: ['업무 유형 확정 후 안내 가능'],
    notes: ['자연어 내용을 더 구체화하면 명의변경, 이사정산, 신규신청, 자동이체 등으로 분류할 수 있습니다.']
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
    label: '한전 전력데이터서비스마켓 EDS API 목록',
    url: 'https://www.data.go.kr/data/15131481/fileData.do',
    description: '한국전력 전력데이터서비스마켓 API 목록'
  }
];
