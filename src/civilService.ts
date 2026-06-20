import { CIVIL_SERVICE_GUIDES, OFFICIAL_LINKS, type CivilServiceType } from './kepcoData.js';

export interface CivilServiceInput {
  text: string;
  serviceType?: CivilServiceType;
  customerNumber?: string;
  address?: string;
  applicantName?: string;
  phone?: string;
  preferredDate?: string;
  details?: string;
}

export interface CivilServiceGuideResult {
  serviceType: CivilServiceType;
  labelKo: string;
  confidence: 'high' | 'medium' | 'low';
  canAutoSubmit: false;
  autoSubmitReason: string;
  description: string;
  kepcoOnPath: string;
  directUrl: string;
  requiredInputs: string[];
  likelyDocuments: string[];
  missingInputs: string[];
  nextSteps: string[];
  draftRequestText: string;
  officialLinks: typeof OFFICIAL_LINKS;
}

function compact(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function hasAny(text: string, keywords: string[]): boolean {
  const loose = compact(text);
  return keywords.some((keyword) => text.includes(keyword) || loose.includes(compact(keyword)));
}

export function inferCivilServiceType(text: string): { serviceType: CivilServiceType; confidence: CivilServiceGuideResult['confidence'] } {
  if (hasAny(text, ['명의변경', '명의 변경', '계약자 변경', '사용자 변경', '이름 바꾸'])) {
    return { serviceType: 'name_change', confidence: 'high' };
  }
  if (hasAny(text, ['이사정산', '이사 정산', '전출', '전입', '이사', '퇴거'])) {
    return { serviceType: 'move_settlement', confidence: 'high' };
  }
  if (hasAny(text, ['전기사용신청', '전기 사용 신청', '신규 전기', '신설', '입주 전기', '사업장 전기 신청'])) {
    return { serviceType: 'new_connection', confidence: 'high' };
  }
  if (hasAny(text, ['증설', '계약전력', '종별변경', '계약종별', '전기사용 변경', '용량 변경'])) {
    return { serviceType: 'contract_change', confidence: 'high' };
  }
  if (hasAny(text, ['자동이체', '계좌이체', '카드 자동', '납부 계좌', '납부 카드'])) {
    return { serviceType: 'auto_payment', confidence: 'high' };
  }
  if (hasAny(text, ['청구서', '모바일 청구', '이메일 청구', '우편 청구', '고지서'])) {
    return { serviceType: 'bill_delivery', confidence: 'high' };
  }
  if (hasAny(text, ['복지할인', '장애인 할인', '대가족', '생명유지', '기초생활', '차상위', '국가유공자'])) {
    return { serviceType: 'welfare_discount', confidence: 'high' };
  }
  if (hasAny(text, ['정전', '전기고장', '고장 신고', '전선', '전주', '감전', '위험설비', '스파크'])) {
    return { serviceType: 'outage_or_danger_report', confidence: 'high' };
  }
  if (hasAny(text, ['고객번호', '고객 번호'])) {
    return { serviceType: 'customer_number_lookup', confidence: 'high' };
  }
  if (hasAny(text, ['요금조회', '요금 조회', '납부', '미납', '청구금액', '전기요금 확인'])) {
    return { serviceType: 'bill_lookup_or_payment', confidence: 'medium' };
  }
  return { serviceType: 'unknown', confidence: 'low' };
}

function missingInputsFor(serviceType: CivilServiceType, input: CivilServiceInput): string[] {
  const missing: string[] = [];
  if (!input.customerNumber && !input.address) {
    missing.push('고객번호 또는 사용장소 주소');
  }
  if (!input.applicantName && !/(성명|이름|신청자)/.test(input.text)) {
    missing.push('신청자 성명');
  }
  if (!input.phone && !/(010|연락처|전화)/.test(input.text)) {
    missing.push('연락처');
  }
  if (serviceType === 'move_settlement' && !input.preferredDate && !/(이사일|전출일|전입일|\d{1,2}월|\d{4}-\d{2}-\d{2})/.test(input.text)) {
    missing.push('이사일 또는 정산 희망일');
  }
  if (serviceType === 'new_connection' && !/(계약전력|몇\s*kW|몇\s*kw|용도|업종)/i.test(input.text)) {
    missing.push('계약전력과 사용 용도');
  }
  if (serviceType === 'auto_payment' && !/(계좌|카드|은행)/.test(input.text)) {
    missing.push('자동이체 수단(계좌/카드)');
  }
  return missing;
}

function makeDraftText(serviceType: CivilServiceType, input: CivilServiceInput): string {
  const guide = CIVIL_SERVICE_GUIDES[serviceType];
  return [
    `[${guide.labelKo} 신청/문의 초안]`,
    `신청자: ${input.applicantName ?? '미입력'}`,
    `연락처: ${input.phone ?? '미입력'}`,
    `고객번호/주소: ${input.customerNumber ?? input.address ?? '미입력'}`,
    `희망일: ${input.preferredDate ?? '미입력'}`,
    `요청 내용: ${input.details ?? input.text}`,
    '위 내용으로 처리 가능 여부와 추가 서류를 확인 부탁드립니다.'
  ].join('\n');
}

export function guideCivilService(input: CivilServiceInput): CivilServiceGuideResult {
  const inferred = input.serviceType ? { serviceType: input.serviceType, confidence: 'high' as const } : inferCivilServiceType(input.text);
  const guide = CIVIL_SERVICE_GUIDES[inferred.serviceType];
  const missingInputs = missingInputsFor(inferred.serviceType, input);

  return {
    serviceType: inferred.serviceType,
    labelKo: guide.labelKo,
    confidence: inferred.confidence,
    canAutoSubmit: false,
    autoSubmitReason:
      '한전ON 로그인, 본인확인, 개인정보/금융정보 입력 또는 내부 민원 API 권한이 필요하므로 이 MCP MVP는 실제 제출 대신 분류, 서류 안내, 신청서 초안 작성, 공식 메뉴 연결까지만 수행합니다.',
    description: guide.description,
    kepcoOnPath: guide.kepcoOnPath,
    directUrl: guide.directUrl,
    requiredInputs: guide.requiredInputs,
    likelyDocuments: guide.likelyDocuments,
    missingInputs,
    nextSteps: [
      missingInputs.length > 0 ? `먼저 보완할 정보: ${missingInputs.join(', ')}` : '필수 입력값 초안은 대부분 채워졌습니다.',
      '아래 신청/문의 초안을 확인한 뒤 한전ON 해당 메뉴에서 본인확인 후 제출하세요.',
      ...guide.notes
    ],
    draftRequestText: makeDraftText(inferred.serviceType, input),
    officialLinks: OFFICIAL_LINKS
  };
}

export function prepareApplicationDraft(input: CivilServiceInput): {
  serviceType: CivilServiceType;
  title: string;
  draftFields: Record<string, string>;
  missingInputs: string[];
  confirmationChecklist: string[];
  draftRequestText: string;
  canSubmit: false;
  handoffUrl: string;
} {
  const guide = guideCivilService(input);
  const source = CIVIL_SERVICE_GUIDES[guide.serviceType];

  return {
    serviceType: guide.serviceType,
    title: `${source.labelKo} 신청서 초안`,
    draftFields: {
      serviceType: source.labelKo,
      applicantName: input.applicantName ?? '미입력',
      phone: input.phone ?? '미입력',
      customerNumber: input.customerNumber ?? '미입력',
      address: input.address ?? '미입력',
      preferredDate: input.preferredDate ?? '미입력',
      details: input.details ?? input.text
    },
    missingInputs: guide.missingInputs,
    confirmationChecklist: [
      '고객번호 또는 주소가 정확한지 확인',
      '신청자/계약자/납부자 정보가 실제 한전ON 인증 정보와 맞는지 확인',
      '개인정보나 금융정보는 PlayMCP 채팅에 그대로 남기지 말고 한전ON 공식 화면에서 최종 입력',
      '정전, 감전, 화재 등 긴급 위험은 신청서보다 123 또는 119 신고 우선'
    ],
    draftRequestText: guide.draftRequestText,
    canSubmit: false,
    handoffUrl: source.directUrl
  };
}

export function getKepcoIntegrationStatus(): {
  availableNow: string[];
  needsKepcoOrUserAuth: string[];
  suggestedMvpFlow: string[];
  officialLinks: typeof OFFICIAL_LINKS;
} {
  return {
    availableNow: [
      '공식 요금표 기반 주택용 전기요금 간이 계산',
      '가전 소비전력/사용시간 기반 월 kWh 증가량 계산',
      '자연어 민원 유형 분류',
      '필요 정보/서류 체크리스트 생성',
      '한전ON 제출 전 신청/문의 문안 작성',
      '한전ON 공식 메뉴 링크 연결'
    ],
    needsKepcoOrUserAuth: [
      '개인 고객번호 기반 실제 청구/납부 내역 조회',
      '자동이체 실제 등록/변경',
      '명의변경/전기사용신청 최종 제출',
      '요금 실제 납부',
      '고객별 AMI 실시간 사용량 조회'
    ],
    suggestedMvpFlow: [
      '사용자 자연어 입력',
      '요금/민원/고장신고 intent 분류',
      '계산 가능한 건 즉시 계산',
      '인증 필요한 건 신청서 초안과 필요서류 체크리스트 생성',
      '한전ON 공식 메뉴로 handoff'
    ],
    officialLinks: OFFICIAL_LINKS
  };
}
