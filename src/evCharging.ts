import { OFFICIAL_DATA_SOURCES, type IntegrationBoundary } from './kepcoData.js';

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
  dataMode: 'provided_candidates' | 'demo_static_candidates';
  parsed: {
    origin?: string;
    destination?: string;
    routeName?: string;
    direction?: string;
    arrivalInMinutes: number;
    desiredKwh?: number;
    connectorType?: string;
    minimumOutputKw?: number;
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
  officialDataSources: typeof OFFICIAL_DATA_SOURCES;
  disclaimer: string;
}

const DEMO_HIGHWAY_CHARGERS: ChargerCandidateInput[] = [
  {
    name: '덕평휴게소 전기차 충전소',
    address: '영동고속도로 덕평휴게소',
    routeName: '영동고속도로',
    direction: '강릉방향',
    operator: '환경부/민간 충전사업자',
    chargerType: '급속',
    connectorType: 'DC콤보',
    outputKw: 100,
    distanceKm: 0,
    status: 'available',
    availableCount: 2,
    chargingCount: 1,
    faultedCount: 0,
    totalCount: 3,
    statusUpdatedAt: 'demo'
  },
  {
    name: '여주휴게소 전기차 충전소',
    address: '영동고속도로 여주휴게소',
    routeName: '영동고속도로',
    direction: '강릉방향',
    operator: '환경부/민간 충전사업자',
    chargerType: '초급속/급속',
    connectorType: 'DC콤보',
    outputKw: 200,
    distanceKm: 33,
    status: 'charging',
    availableCount: 0,
    chargingCount: 3,
    faultedCount: 0,
    totalCount: 3,
    statusUpdatedAt: 'demo'
  },
  {
    name: '문막휴게소 전기차 충전소',
    address: '영동고속도로 문막휴게소',
    routeName: '영동고속도로',
    direction: '강릉방향',
    operator: '환경부/민간 충전사업자',
    chargerType: '급속',
    connectorType: 'DC콤보',
    outputKw: 100,
    distanceKm: 62,
    status: 'available',
    availableCount: 1,
    chargingCount: 2,
    faultedCount: 0,
    totalCount: 3,
    statusUpdatedAt: 'demo'
  }
];

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

  let connectorType = input.connectorType;
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
  if (parsed.connectorType && candidate.connectorType && !candidate.connectorType.includes(parsed.connectorType)) {
    score -= 35;
    reasons.push(`요청 커넥터(${parsed.connectorType})와 후보 커넥터(${candidate.connectorType})가 다를 수 있습니다.`);
  }
  if (candidate.statusUpdatedAt === 'demo' || !candidate.statusUpdatedAt) {
    score -= 5;
    reasons.push('실시간 API 값이 아닌 데모/미입력 상태이므로 운영 환경에서는 최신 상태 갱신이 필요합니다.');
  }
  if (estimatedArrivalMinutes > 45 && availableCount === 1) {
    score -= 6;
    reasons.push('도착까지 시간이 있어 현재 사용 가능 상태가 바뀔 수 있습니다.');
  }
  if (estimatedChargeMinutes) {
    reasons.push(`${parsed.desiredKwh}kWh 충전에 약 ${estimatedChargeMinutes}분이 필요합니다(충전손실/감속 여유 포함).`);
  }

  const recommendation: EvChargingPlanCandidate['recommendation'] = score >= 35 ? 'plan_a' : score >= 10 ? 'plan_b' : 'avoid';

  return {
    name: candidate.name,
    address: candidate.address,
    routeName: candidate.routeName,
    direction: candidate.direction,
    operator: candidate.operator,
    chargerType: candidate.chargerType,
    connectorType: candidate.connectorType,
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

function buildVisitPlanText(planA?: EvChargingPlanCandidate, planB?: EvChargingPlanCandidate): string {
  if (!planA) {
    return '현재 조건에 맞는 충전소 후보가 부족합니다. 도착 예정시간, 커넥터 타입, 경로 또는 후보 충전소 상태를 추가로 입력해 주세요.';
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

  lines.push('', '실제 예약 확정은 충전사업자 관제 API/OCPP 예약 기능 연계가 필요합니다. MVP에서는 방문 플랜과 대체 후보를 제공합니다.');
  return lines.join('\n');
}

export function planEvChargingVisit(input: EvChargingPlanInput): EvChargingPlanResult {
  const parsed = parseText(input);
  const candidates = input.candidates && input.candidates.length > 0 ? input.candidates : DEMO_HIGHWAY_CHARGERS;
  const dataMode: EvChargingPlanResult['dataMode'] = input.candidates && input.candidates.length > 0 ? 'provided_candidates' : 'demo_static_candidates';
  const scored = candidates
    .filter((candidate) => {
      const routeOk = !parsed.routeName || !candidate.routeName || candidate.routeName.includes(parsed.routeName) || parsed.routeName.includes(candidate.routeName);
      const directionOk = !parsed.direction || !candidate.direction || candidate.direction.includes(parsed.direction) || parsed.direction.includes(candidate.direction);
      return routeOk && directionOk;
    })
    .map((candidate) => scoreCandidate(candidate, parsed))
    .sort((a, b) => b.availabilityScore - a.availabilityScore);

  const planA = scored.find((candidate) => candidate.recommendation === 'plan_a') ?? scored[0];
  const planB = scored.find((candidate) => candidate.name !== planA?.name && candidate.recommendation !== 'avoid');

  return {
    dataMode,
    parsed: {
      origin: input.origin,
      destination: input.destination,
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
    visitPlanText: buildVisitPlanText(planA, planB),
    reservationBoundary: {
      currentMvp: '도착시점 기반 충전 방문 플랜, 대체 후보, 예약 요청서 수준까지 제공합니다.',
      actualReservationRequires: [
        '충전사업자(CPO) 관제 API',
        '충전기 원격 인증 또는 예약 상태 제어',
        'OCPP ReserveNow/CancelReservation 또는 사업자별 동등 기능',
        '회원/차량/결제 수단 연동',
        '노쇼/지연/취소 운영정책'
      ],
      integrationBoundary: 'needs_partner_agreement'
    },
    officialDataSources: OFFICIAL_DATA_SOURCES.filter((source) =>
      ['keco_ev_charger_api', 'ex_rest_area_charger_data', 'ocpp_standard'].includes(source.id)
    ),
    disclaimer:
      dataMode === 'demo_static_candidates'
        ? '서비스키가 있는 실시간 충전소 API 응답 또는 사용자가 제공한 후보가 없어서 데모 후보로 플랜을 만들었습니다.'
        : '사용자가 제공한 충전소 후보 상태를 기준으로 한 계획입니다. 실제 점유 상태는 도착 전 다시 확인해야 합니다.'
  };
}
