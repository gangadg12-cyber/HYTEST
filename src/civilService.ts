import {
  CIVIL_SERVICE_GUIDES,
  CIVIL_SERVICE_ITEMS,
  OFFICIAL_DATA_SOURCES,
  OFFICIAL_LINKS,
  type CivilServiceType,
  type IntegrationBoundary,
  type KepcoCivilServiceItem
} from './kepcoData.js';

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
  answerSummary: string;
  confidence: 'high' | 'medium' | 'low';
  matchedCivilServiceItems: CivilServiceMatch[];
  boundary: IntegrationBoundary;
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

export interface CivilServiceMatch {
  code: string;
  labelKo: string;
  category: string;
  serviceType: CivilServiceType;
  boundary: IntegrationBoundary;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  officialPath: string;
  requiredInputs: string[];
  likelyDocuments: string[];
  mcpAction: string;
}

export interface CivilServiceCatalogOptions {
  category?: string;
  limit?: number;
  includeDetails?: boolean;
}

function compact(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function hasAny(text: string, keywords: string[]): boolean {
  const loose = compact(text);
  return keywords.some((keyword) => text.includes(keyword) || loose.includes(compact(keyword)));
}

function confidenceFromScore(score: number): CivilServiceMatch['confidence'] {
  if (score >= 9) {
    return 'high';
  }
  if (score >= 4) {
    return 'medium';
  }
  return 'low';
}

function tokenScore(text: string, item: KepcoCivilServiceItem): number {
  const original = text.toLowerCase();
  const loose = compact(text);
  let score = 0;

  if (original.includes(item.labelKo.toLowerCase()) || loose.includes(compact(item.labelKo))) {
    score += 10;
  }
  if (original.includes(item.category.toLowerCase()) || loose.includes(compact(item.category))) {
    score += 2;
  }

  for (const keyword of item.keywords) {
    if (keyword && (original.includes(keyword.toLowerCase()) || loose.includes(compact(keyword)))) {
      score += keyword === item.labelKo ? 4 : 3;
    }
  }

  return score;
}

export function classifyCivilServiceCatalog(text: string, limit = 5): {
  input: string;
  catalogSize: number;
  matches: CivilServiceMatch[];
  fallback: { serviceType: CivilServiceType; confidence: CivilServiceGuideResult['confidence'] };
  boundarySummary: Record<IntegrationBoundary, number>;
} {
  const matches = CIVIL_SERVICE_ITEMS.map((item) => {
    const score = tokenScore(text, item);
    return {
      code: item.code,
      labelKo: item.labelKo,
      category: item.category,
      serviceType: item.serviceType,
      boundary: item.boundary,
      score,
      confidence: confidenceFromScore(score),
      officialPath: item.officialPath,
      requiredInputs: item.requiredInputs,
      likelyDocuments: item.likelyDocuments,
      mcpAction: item.mcpAction
    };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.labelKo.localeCompare(b.labelKo, 'ko'))
    .slice(0, limit);

  return {
    input: text,
    catalogSize: CIVIL_SERVICE_ITEMS.length,
    matches,
    fallback: inferCivilServiceType(text),
    boundarySummary: {
      available_now: CIVIL_SERVICE_ITEMS.filter((item) => item.boundary === 'available_now').length,
      needs_user_auth_or_api: CIVIL_SERVICE_ITEMS.filter((item) => item.boundary === 'needs_user_auth_or_api').length,
      needs_partner_agreement: CIVIL_SERVICE_ITEMS.filter((item) => item.boundary === 'needs_partner_agreement').length
    }
  };
}

export function inferCivilServiceType(text: string): { serviceType: CivilServiceType; confidence: CivilServiceGuideResult['confidence'] } {
  const catalogMatch = CIVIL_SERVICE_ITEMS.map((item) => ({ item, score: tokenScore(text, item) }))
    .filter(({ score }) => score >= 7)
    .sort((a, b) => b.score - a.score)[0];
  if (catalogMatch) {
    return {
      serviceType: catalogMatch.item.serviceType,
      confidence: confidenceFromScore(catalogMatch.score)
    };
  }

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
  if (hasAny(text, ['세금계산서', '증명서', '진위확인'])) {
    return { serviceType: 'certificate_or_tax', confidence: 'medium' };
  }
  if (hasAny(text, ['검침', '납기일', '계량기', '원격검침', 'AMI'])) {
    return { serviceType: 'metering_or_due_date', confidence: 'medium' };
  }
  if (hasAny(text, ['PPA', '상계거래', '요금상계'])) {
    return { serviceType: 'ppa_or_offset', confidence: 'medium' };
  }
  if (hasAny(text, ['전기차충전소 사용량', '충전소 사용량 제출'])) {
    return { serviceType: 'ev_charger_usage_submission', confidence: 'high' };
  }
  return { serviceType: 'unknown', confidence: 'low' };
}

function missingInputsFor(serviceType: CivilServiceType, input: CivilServiceInput): string[] {
  const missing: string[] = [];
  if (serviceType === 'outage_or_danger_report') {
    if (!input.address && !/(위치|주소|근처|앞|옆|도로|전주|전선)/.test(input.text)) {
      missing.push('고장/위험설비 위치');
    }
    if (!input.phone && !/(010|연락처|전화)/.test(input.text)) {
      missing.push('연락처');
    }
    return missing;
  }

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

function mergeUnique(primary: string[], secondary: string[]): string[] {
  return Array.from(new Set([...primary, ...secondary]));
}

function buildAnswerSummary(input: {
  labelKo: string;
  description: string;
  kepcoOnPath: string;
  boundary: IntegrationBoundary;
  requiredInputs: string[];
  likelyDocuments: string[];
  missingInputs: string[];
  autoSubmitReason: string;
}): string {
  const boundaryText =
    input.boundary === 'available_now'
      ? '현재 MCP 안에서 분류, 안내, 신고/문의 초안까지 바로 처리할 수 있습니다.'
      : input.boundary === 'needs_user_auth_or_api'
        ? '최종 신청/조회/납부는 한전ON 로그인·본인확인 또는 공식 API 권한이 필요합니다.'
        : '실제 처리에는 KEPCO 또는 외부 사업자와의 별도 협약/API 연계가 필요합니다.';

  return [
    `${input.labelKo}: ${input.description}`,
    `공식 경로: ${input.kepcoOnPath}`,
    `준비 정보: ${input.requiredInputs.length > 0 ? input.requiredInputs.join(', ') : '별도 입력값 없음'}`,
    `예상 서류: ${input.likelyDocuments.length > 0 ? input.likelyDocuments.join(', ') : '상황별 확인 필요'}`,
    input.missingInputs.length > 0 ? `추가로 필요한 정보: ${input.missingInputs.join(', ')}` : '필수 입력값 초안은 대부분 채워졌습니다.',
    boundaryText,
    input.autoSubmitReason
  ].join('\n');
}

export function guideCivilService(input: CivilServiceInput): CivilServiceGuideResult {
  const catalog = classifyCivilServiceCatalog(input.text);
  const bestItem = catalog.matches[0];
  const inferred = input.serviceType ? { serviceType: input.serviceType, confidence: 'high' as const } : inferCivilServiceType(input.text);
  const guide = CIVIL_SERVICE_GUIDES[inferred.serviceType];
  const missingInputs = missingInputsFor(inferred.serviceType, input);
  const boundary = bestItem?.boundary ?? (inferred.serviceType === 'outage_or_danger_report' ? 'available_now' : 'needs_user_auth_or_api');
  const requiredInputs = bestItem ? mergeUnique(bestItem.requiredInputs, guide.requiredInputs) : guide.requiredInputs;
  const likelyDocuments = bestItem ? mergeUnique(bestItem.likelyDocuments, guide.likelyDocuments) : guide.likelyDocuments;
  const autoSubmitReason =
    '한전ON 로그인, 본인확인, 개인정보/금융정보 입력 또는 내부 민원 API 권한이 필요하므로 이 MCP MVP는 실제 제출 대신 분류, 서류 안내, 신청서 초안 작성, 공식 메뉴 연결까지만 수행합니다.';
  const kepcoOnPath = bestItem?.officialPath ?? guide.kepcoOnPath;
  const answerSummary = buildAnswerSummary({
    labelKo: guide.labelKo,
    description: guide.description,
    kepcoOnPath,
    boundary,
    requiredInputs,
    likelyDocuments,
    missingInputs,
    autoSubmitReason
  });

  return {
    serviceType: inferred.serviceType,
    labelKo: guide.labelKo,
    answerSummary,
    confidence: inferred.confidence,
    matchedCivilServiceItems: catalog.matches,
    boundary,
    canAutoSubmit: false,
    autoSubmitReason,
    description: guide.description,
    kepcoOnPath,
    directUrl: guide.directUrl,
    requiredInputs,
    likelyDocuments,
    missingInputs,
    nextSteps: [
      missingInputs.length > 0 ? `먼저 보완할 정보: ${missingInputs.join(', ')}` : '필수 입력값 초안은 대부분 채워졌습니다.',
      bestItem ? `가장 가까운 한전ON 민원 항목: ${bestItem.category} > ${bestItem.labelKo}` : '민원 항목이 확실하지 않으면 한전ON 민원신청에서 다시 확인하세요.',
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
  answerSummary: string;
  draftFields: Record<string, string>;
  matchedCivilServiceItems: CivilServiceMatch[];
  boundary: IntegrationBoundary;
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
    answerSummary: guide.answerSummary,
    draftFields: {
      serviceType: source.labelKo,
      officialPath: guide.kepcoOnPath,
      applicantName: input.applicantName ?? '미입력',
      phone: input.phone ?? '미입력',
      customerNumber: input.customerNumber ?? '미입력',
      address: input.address ?? '미입력',
      preferredDate: input.preferredDate ?? '미입력',
      details: input.details ?? input.text
    },
    matchedCivilServiceItems: guide.matchedCivilServiceItems,
    boundary: guide.boundary,
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
  needsPartnerAgreement: string[];
  suggestedMvpFlow: string[];
  dataSources: typeof OFFICIAL_DATA_SOURCES;
  civilServiceCatalog: {
    total: number;
    availableNow: number;
    needsUserAuthOrApi: number;
    needsPartnerAgreement: number;
  };
  officialLinks: typeof OFFICIAL_LINKS;
} {
  return {
    availableNow: [
      '공식 요금표 기반 주택용 전기요금 간이 계산',
      '가전 소비전력/사용시간 기반 월 kWh 증가량 계산',
      '한전ON 민원신청 63건 기준 자연어 민원 유형 분류',
      '필요 정보/서류 체크리스트 생성',
      '한전ON 제출 전 신청/문의 문안 작성',
      '한전ON 공식 메뉴 링크 연결',
      '전기차 충전소 공개 API 구조에 맞춘 도착시점 방문 플랜 생성',
      '실시간 충전소 API가 없어도 사용자가 제공한 후보 또는 데모 후보 기준의 제한적 방문 플랜 생성'
    ],
    needsKepcoOrUserAuth: [
      '개인 고객번호 기반 실제 청구/납부 내역 조회',
      '자동이체 실제 등록/변경',
      '명의변경/전기사용신청 최종 제출',
      '요금 실제 납부',
      '고객별 AMI 실시간 사용량 조회',
      '한전ON 민원 접수 결과 조회'
    ],
    needsPartnerAgreement: [
      '충전사업자 관제 API를 통한 실제 충전소 예약 확정',
      '예약자 외 충전 차단 또는 원격 인증',
      '충전 결제 및 회원 연동',
      '차량 제조사 배터리/도착예정시간 연동'
    ],
    suggestedMvpFlow: [
      '사용자 자연어 입력',
      '요금/민원/고장신고 intent 분류',
      '계산 가능한 건 즉시 계산',
      '인증 필요한 건 신청서 초안과 필요서류 체크리스트 생성',
      '한전ON 공식 메뉴로 handoff'
    ],
    dataSources: OFFICIAL_DATA_SOURCES,
    civilServiceCatalog: {
      total: CIVIL_SERVICE_ITEMS.length,
      availableNow: CIVIL_SERVICE_ITEMS.filter((item) => item.boundary === 'available_now').length,
      needsUserAuthOrApi: CIVIL_SERVICE_ITEMS.filter((item) => item.boundary === 'needs_user_auth_or_api').length,
      needsPartnerAgreement: CIVIL_SERVICE_ITEMS.filter((item) => item.boundary === 'needs_partner_agreement').length
    },
    officialLinks: OFFICIAL_LINKS
  };
}

export function listKepcoCivilServiceCatalog(options: CivilServiceCatalogOptions = {}): {
  total: number;
  returned: number;
  categoryFilter?: string;
  includeDetails: boolean;
  categories: Array<{
    category: string;
    count: number;
    items: Array<{
      code: string;
      labelKo: string;
      serviceType: CivilServiceType;
      boundary: IntegrationBoundary;
      officialPath: string;
    }>;
  }>;
  items?: KepcoCivilServiceItem[];
  summaryText: string;
} {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), CIVIL_SERVICE_ITEMS.length);
  const filtered = options.category
    ? CIVIL_SERVICE_ITEMS.filter((item) => item.category.includes(options.category ?? ''))
    : CIVIL_SERVICE_ITEMS;
  const limited = filtered.slice(0, limit);
  const categoryNames = Array.from(new Set(filtered.map((item) => item.category)));
  const categories = categoryNames.map((category) => {
    const items = filtered
      .filter((item) => item.category === category)
      .slice(0, options.includeDetails ? limit : 8)
      .map((item) => ({
        code: item.code,
        labelKo: item.labelKo,
        serviceType: item.serviceType,
        boundary: item.boundary,
        officialPath: item.officialPath
      }));
    return {
      category,
      count: filtered.filter((item) => item.category === category).length,
      items
    };
  });

  return {
    total: CIVIL_SERVICE_ITEMS.length,
    returned: limited.length,
    categoryFilter: options.category,
    includeDetails: Boolean(options.includeDetails),
    categories,
    items: options.includeDetails ? limited : undefined,
    summaryText: categories
      .map((category) => {
        const labels = category.items.map((item) => item.labelKo).join(', ');
        return `${category.category} (${category.count}건): ${labels}`;
      })
      .join('\n')
  };
}
