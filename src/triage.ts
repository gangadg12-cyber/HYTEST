import {
  BODY_PART_KEYWORDS,
  DISCLAIMER,
  RED_FLAG_RULES,
  SYMPTOM_CATEGORIES,
  URGENCY_LABELS,
  URGENCY_RANK,
  type RedFlagRule,
  type SymptomCategory,
  type UrgencyLevel
} from './medicalData.js';

export interface ParsedChildSymptoms {
  originalText: string;
  ageMonths?: number;
  ageText?: string;
  temperatureC?: number;
  durationText?: string;
  bodyParts: string[];
  symptomKeywords: string[];
  categories: Array<{
    id: string;
    labelKo: string;
    labelEn: string;
    score: number;
    specialties: string[];
  }>;
  redFlags: Array<{
    id: string;
    labelKo: string;
    urgency: UrgencyLevel;
    reason: string;
    action: string;
  }>;
  missingQuestions: string[];
}

export interface TriageResult {
  urgency: UrgencyLevel;
  urgencyLabel: string;
  primaryCategory?: string;
  recommendedSpecialties: string[];
  reasons: string[];
  nextActions: string[];
  missingQuestions: string[];
  redFlags: ParsedChildSymptoms['redFlags'];
  disclaimer: string;
}

const AGE_MONTH_WORDS = ['개월', '달'];
const AGE_YEAR_WORDS = ['살', '세'];

function compact(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

function includesLoose(text: string, keyword: string): boolean {
  return text.includes(keyword.toLowerCase()) || compact(text).includes(compact(keyword));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function parseAgeMonths(text: string, explicitAgeMonths?: number): { ageMonths?: number; ageText?: string } {
  if (typeof explicitAgeMonths === 'number' && Number.isFinite(explicitAgeMonths) && explicitAgeMonths >= 0) {
    return { ageMonths: Math.round(explicitAgeMonths), ageText: `${Math.round(explicitAgeMonths)}개월` };
  }

  const normalized = text.replace(/\s+/g, ' ');
  const monthMatch = normalized.match(/(\d{1,2})\s*(개월|달)/);
  if (monthMatch && AGE_MONTH_WORDS.includes(monthMatch[2] ?? '')) {
    const months = Number.parseInt(monthMatch[1] ?? '', 10);
    return { ageMonths: months, ageText: `${months}개월` };
  }

  const yearMatch = normalized.match(/(?:만\s*)?(\d{1,2})\s*(살|세)/);
  if (yearMatch && AGE_YEAR_WORDS.includes(yearMatch[2] ?? '')) {
    const years = Number.parseInt(yearMatch[1] ?? '', 10);
    return { ageMonths: years * 12, ageText: `${years}세` };
  }

  if (/(신생아|갓난|생후\s*1개월|한달)/.test(normalized)) {
    return { ageMonths: 1, ageText: '신생아/생후 1개월 전후' };
  }

  if (/(영아|아기|돌 전|돌전)/.test(normalized)) {
    return { ageText: '영아로 표현됨' };
  }

  return {};
}

export function parseTemperature(text: string, explicitTemperatureC?: number): number | undefined {
  if (
    typeof explicitTemperatureC === 'number' &&
    Number.isFinite(explicitTemperatureC) &&
    explicitTemperatureC >= 30 &&
    explicitTemperatureC <= 45
  ) {
    return Number(explicitTemperatureC.toFixed(1));
  }

  const match = text.match(/(3[5-9]|4[0-2])(?:\.(\d))?\s*(?:도|℃|c|C)?/);
  if (!match) {
    return undefined;
  }

  const whole = match[1] ?? '';
  const decimal = match[2] ? `.${match[2]}` : '';
  return Number.parseFloat(`${whole}${decimal}`);
}

export function parseDuration(text: string): string | undefined {
  const duration = text.match(/(\d{1,2})\s*(분|시간|일|주|개월)\s*(전부터|째|동안|전)?/);
  if (duration) {
    return duration[0];
  }

  const fuzzy = ['오늘 아침', '오늘 밤', '새벽', '어제', '그제', '방금', '갑자기', '며칠'];
  return fuzzy.find((word) => text.includes(word));
}

function scoreCategory(text: string, category: SymptomCategory, detectedBodyParts: string[]): number {
  const keywordScore = category.keywords.reduce((score, keyword) => score + (includesLoose(text, keyword) ? 2 : 0), 0);
  const bodyScore = category.bodyParts.reduce((score, bodyPart) => score + (detectedBodyParts.includes(bodyPart) ? 1 : 0), 0);
  return keywordScore + bodyScore;
}

function detectBodyParts(text: string): string[] {
  const detected: string[] = [];
  for (const [bodyPart, keywords] of Object.entries(BODY_PART_KEYWORDS)) {
    if (keywords.some((keyword) => includesLoose(text, keyword))) {
      detected.push(bodyPart);
    }
  }
  const bodyParts = unique(detected);
  const explicitNeck = [
    '목덜미',
    '목이',
    '목을',
    '목은',
    '목에',
    '목도',
    '목 경직',
    '목경직',
    '목이 뻣뻣',
    '목뻣뻣',
    '목 아',
    '목아',
    '목 통증',
    '목통증',
    '고개'
  ].some((keyword) => includesLoose(text, keyword));

  if (bodyParts.includes('neck') && !explicitNeck) {
    return bodyParts.filter((bodyPart) => bodyPart !== 'neck');
  }

  return bodyParts;
}

function detectKeywordHits(text: string): string[] {
  const hits: string[] = [];
  for (const category of SYMPTOM_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (includesLoose(text, keyword)) {
        hits.push(keyword);
      }
    }
  }
  return unique(hits);
}

function toRedFlagResult(rule: RedFlagRule): ParsedChildSymptoms['redFlags'][number] {
  return {
    id: rule.id,
    labelKo: rule.labelKo,
    urgency: rule.urgency,
    reason: rule.reason,
    action: rule.action
  };
}

function detectRedFlags(
  text: string,
  ageMonths: number | undefined,
  temperatureC: number | undefined,
  categoryIds: string[]
): ParsedChildSymptoms['redFlags'] {
  const matched = RED_FLAG_RULES.filter((rule) => rule.keywords.some((keyword) => includesLoose(text, keyword))).map(toRedFlagResult);

  if (typeof ageMonths === 'number' && ageMonths < 3 && typeof temperatureC === 'number' && temperatureC >= 38) {
    matched.push({
      id: 'young_infant_fever',
      labelKo: '3개월 미만 영아 발열',
      urgency: 'emergency_room',
      reason: '3개월 미만 영아의 38도 이상 발열은 빠른 진료 평가가 필요합니다.',
      action: '응급실 또는 즉시 진료 가능한 소아 의료기관에 연락/방문하세요.'
    });
  }

  if (typeof temperatureC === 'number' && temperatureC >= 40) {
    matched.push({
      id: 'very_high_fever',
      labelKo: '40도 이상 고열',
      urgency: 'urgent_pediatric_care',
      reason: '40도 이상 고열은 아이의 전신 상태와 동반 증상 확인이 필요합니다.',
      action: '당일 소아진료 또는 야간/휴일 진료기관 상담을 권장합니다.'
    });
  }

  if (
    categoryIds.includes('skin_allergy') &&
    (includesLoose(text, '숨') || includesLoose(text, '호흡') || includesLoose(text, '목이 붓') || includesLoose(text, '혀가 붓'))
  ) {
    matched.push({
      id: 'allergy_with_airway_symptom',
      labelKo: '알레르기 + 호흡/부종 증상',
      urgency: 'call_119_now',
      reason: '두드러기나 부종에 호흡 증상이 동반되면 중증 알레르기 가능성을 우선 봐야 합니다.',
      action: '즉시 119에 연락하세요.'
    });
  }

  if (
    (includesLoose(text, '목이 뻣뻣') || includesLoose(text, '목 경직')) &&
    (includesLoose(text, '두통') || includesLoose(text, '머리') || includesLoose(text, '구토') || includesLoose(text, '토했'))
  ) {
    matched.push({
      id: 'neck_stiffness_with_headache_or_vomit',
      labelKo: '두통/구토 동반 목 경직',
      urgency: 'emergency_room',
      reason: '두통 또는 구토에 목 경직이 동반되면 응급 평가가 필요한 감염/신경계 위험신호일 수 있습니다.',
      action: '가까운 응급실 또는 119 구급상황관리센터에 전화해 이동 필요성을 확인하세요.'
    });
  }

  return Object.values(
    matched.reduce<Record<string, ParsedChildSymptoms['redFlags'][number]>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {})
  );
}

function buildMissingQuestions(parsed: Omit<ParsedChildSymptoms, 'missingQuestions'>): string[] {
  const questions: string[] = [];
  const categoryIds = parsed.categories.map((category) => category.id);

  if (typeof parsed.ageMonths !== 'number') {
    questions.push('아이 나이가 몇 개월/몇 살인가요?');
  }

  if (categoryIds.includes('fever') && typeof parsed.temperatureC !== 'number') {
    questions.push('현재 체온은 몇 도인가요?');
  }

  if (categoryIds.includes('respiratory')) {
    questions.push('숨쉬기 힘들어 보이거나 입술이 파래 보이나요?');
  }

  if (categoryIds.includes('gastrointestinal')) {
    questions.push('마지막 소변 시간과 구토/설사 횟수는 어떻게 되나요?');
  }

  if (categoryIds.includes('neurologic')) {
    questions.push('의식이 평소와 같고, 깨우면 잘 반응하나요?');
  }

  if (categoryIds.includes('trauma_burn')) {
    questions.push('다친 시간, 부위, 출혈 여부, 머리 충격 여부를 알려주세요.');
  }

  if (!parsed.durationText) {
    questions.push('증상이 언제부터 시작됐나요?');
  }

  return unique(questions).slice(0, 3);
}

export function analyzeSymptoms(input: {
  text: string;
  childAgeMonths?: number;
  temperatureC?: number;
}): ParsedChildSymptoms {
  const text = input.text.trim();
  const { ageMonths, ageText } = parseAgeMonths(text, input.childAgeMonths);
  const temperatureC = parseTemperature(text, input.temperatureC);
  const durationText = parseDuration(text);
  const bodyParts = detectBodyParts(text);
  const symptomKeywords = detectKeywordHits(text);

  const scoredCategories = SYMPTOM_CATEGORIES.map((category) => ({
    category,
    score: scoreCategory(text, category, bodyParts)
  }))
    .filter((item) => item.score > 0);

  const traumaScore = scoredCategories.find((item) => item.category.id === 'trauma_burn')?.score ?? 0;
  const neurologicScore = scoredCategories.find((item) => item.category.id === 'neurologic')?.score ?? 0;
  const explicitSkinOrAllergy = ['피부', '발진', '두드러기', '가려', '알레르기', '입술', '얼굴'].some((keyword) =>
    includesLoose(text, keyword)
  );
  const explicitNeurologic = [
    '경련',
    '발작',
    '의식',
    '깨워',
    '반응',
    '축 처',
    '두통',
    '어지',
    '목이 뻣뻣',
    '목 경직',
    '마비',
    '감각',
    '말이 어눌'
  ].some((keyword) => includesLoose(text, keyword));

  const categories = scoredCategories
    .filter((item) => !(item.category.id === 'skin_allergy' && traumaScore > item.score && !explicitSkinOrAllergy))
    .filter((item) => !(item.category.id === 'neurologic' && traumaScore > neurologicScore && !explicitNeurologic))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ category, score }) => ({
      id: category.id,
      labelKo: category.labelKo,
      labelEn: category.labelEn,
      score,
      specialties: category.specialties
    }));

  const categoryIds = categories.map((category) => category.id);
  const redFlags = detectRedFlags(text, ageMonths, temperatureC, categoryIds);

  const withoutQuestions = {
    originalText: text,
    ageMonths,
    ageText,
    temperatureC,
    durationText,
    bodyParts,
    symptomKeywords,
    categories,
    redFlags
  };

  return {
    ...withoutQuestions,
    missingQuestions: buildMissingQuestions(withoutQuestions)
  };
}

export function triageSymptoms(input: {
  text: string;
  childAgeMonths?: number;
  temperatureC?: number;
}): { parsed: ParsedChildSymptoms; triage: TriageResult } {
  const parsed = analyzeSymptoms(input);
  const primary = parsed.categories[0];
  const categoryIds = parsed.categories.map((category) => category.id);
  const reasons: string[] = [];
  const nextActions: string[] = [];
  let urgency: UrgencyLevel = primary ? 'outpatient_pediatrics' : 'home_observation';

  for (const redFlag of parsed.redFlags) {
    if (URGENCY_RANK[redFlag.urgency] > URGENCY_RANK[urgency]) {
      urgency = redFlag.urgency;
    }
    reasons.push(redFlag.reason);
    nextActions.push(redFlag.action);
  }

  if (categoryIds.includes('respiratory') && parsed.symptomKeywords.some((keyword) => ['숨', '호흡', '쌕쌕'].includes(keyword))) {
    if (URGENCY_RANK.urgent_pediatric_care > URGENCY_RANK[urgency]) {
      urgency = 'urgent_pediatric_care';
    }
    reasons.push('호흡기 증상은 호흡곤란 여부에 따라 긴급도가 크게 달라집니다.');
  }

  if (categoryIds.includes('fever') && typeof parsed.temperatureC === 'number') {
    if (parsed.temperatureC >= 39 && URGENCY_RANK.urgent_pediatric_care > URGENCY_RANK[urgency]) {
      urgency = 'urgent_pediatric_care';
      reasons.push('39도 이상 발열은 아이의 나이와 전신 상태를 함께 확인해야 합니다.');
    } else if (parsed.temperatureC >= 38 && urgency === 'home_observation') {
      urgency = 'outpatient_pediatrics';
      reasons.push('발열이 있어 소아과 진료 또는 상담을 고려할 수 있습니다.');
    }
  }

  if (categoryIds.includes('gastrointestinal') && /(반복|계속|여러 번|못 마)/.test(parsed.originalText)) {
    if (URGENCY_RANK.urgent_pediatric_care > URGENCY_RANK[urgency]) {
      urgency = 'urgent_pediatric_care';
    }
    reasons.push('반복 구토/설사는 탈수 여부 확인이 필요합니다.');
  }

  if (categoryIds.includes('trauma_burn') && /(못 걷|못걸|못 움직|물집|얼굴 화상|머리)/.test(parsed.originalText)) {
    if (URGENCY_RANK.urgent_pediatric_care > URGENCY_RANK[urgency]) {
      urgency = 'urgent_pediatric_care';
    }
    reasons.push('외상/화상에서 보행 불가, 물집, 머리 충격은 당일 진료 판단이 필요합니다.');
  }

  if (!primary && parsed.redFlags.length === 0) {
    reasons.push('입력된 정보만으로는 특정 증상 카테고리가 충분히 뚜렷하지 않습니다.');
    nextActions.push('아이 나이, 체온, 증상 시작 시점, 가장 불편한 부위를 추가로 알려주세요.');
  }

  if (urgency === 'call_119_now') {
    nextActions.unshift('지금 증상이 계속된다면 PlayMCP 응답을 기다리지 말고 119에 바로 연락하세요.');
  } else if (urgency === 'emergency_room') {
    nextActions.unshift('가까운 응급실 또는 119 구급상황관리센터에 전화해 이동 필요성을 확인하세요.');
  } else if (urgency === 'urgent_pediatric_care') {
    nextActions.unshift('오늘 안에 진료 가능한 소아청소년과, 달빛어린이병원, 야간진료기관을 확인하세요.');
  } else if (urgency === 'outpatient_pediatrics') {
    nextActions.unshift('가능하면 소아청소년과 외래 또는 전화 상담으로 진료 필요성을 확인하세요.');
  } else {
    nextActions.unshift('현재 정보상 위험신호가 뚜렷하지 않으면 관찰하되, 악화 신호가 생기면 즉시 진료로 전환하세요.');
  }

  const recommendedSpecialties = unique(primary?.specialties ?? ['소아청소년과']);

  return {
    parsed,
    triage: {
      urgency,
      urgencyLabel: URGENCY_LABELS[urgency],
      primaryCategory: primary?.labelKo,
      recommendedSpecialties,
      reasons: unique(reasons).slice(0, 5),
      nextActions: unique(nextActions).slice(0, 5),
      missingQuestions: parsed.missingQuestions,
      redFlags: parsed.redFlags,
      disclaimer: DISCLAIMER
    }
  };
}

export function buildObservationChecklist(parsed: ParsedChildSymptoms): string[] {
  const categoryIds = parsed.categories.map((category) => category.id);
  const checklist = [
    '아이의 의식/반응이 평소와 같은지 확인',
    '호흡이 가쁘거나 갈비뼈가 들어가는지 확인',
    '수분 섭취와 마지막 소변 시간을 확인',
    '증상 시작 시각, 체온, 구토/설사/기침 횟수를 기록'
  ];

  for (const categoryId of categoryIds) {
    const category = SYMPTOM_CATEGORIES.find((item) => item.id === categoryId);
    if (category) {
      checklist.push(...category.observationGuide);
      checklist.push(`악화 신호: ${category.warningSignals.join(', ')}`);
    }
  }

  checklist.push('보호자가 보기에도 평소와 다르거나 위험하다고 느끼면 119 또는 응급실을 우선 이용');
  return unique(checklist).slice(0, 10);
}

export function buildHandoffSummary(input: {
  text: string;
  childAgeMonths?: number;
  temperatureC?: number;
  destination?: '119' | 'hospital' | 'icaretok' | 'booking';
}): string {
  const { parsed, triage } = triageSymptoms(input);
  const destinationLabel = input.destination === '119' ? '119 신고' : input.destination === 'icaretok' ? '아이안심톡 상담' : '의료기관 문의';
  const age = parsed.ageText ?? (typeof parsed.ageMonths === 'number' ? `${parsed.ageMonths}개월` : '나이 미상');
  const temp = typeof parsed.temperatureC === 'number' ? `${parsed.temperatureC}도` : '체온 미상';
  const category = triage.primaryCategory ?? '분류 불충분';
  const duration = parsed.durationText ?? '시작 시점 미상';
  const redFlags = parsed.redFlags.length > 0 ? parsed.redFlags.map((flag) => flag.labelKo).join(', ') : '뚜렷한 위험신호 입력 없음';
  const questions = triage.missingQuestions.length > 0 ? triage.missingQuestions.join(' / ') : '추가 확인 질문 없음';

  return [
    `[${destinationLabel} 전달 요약]`,
    `아이: ${age}`,
    `현재 체온: ${temp}`,
    `주요 증상: ${parsed.originalText}`,
    `증상 시작: ${duration}`,
    `예상 증상 카테고리: ${category}`,
    `긴급도 안내: ${triage.urgencyLabel}`,
    `위험신호: ${redFlags}`,
    `추가 확인 필요: ${questions}`,
    '진단 요청이 아니라 증상 설명과 진료 필요성 확인을 위해 문의드립니다.'
  ].join('\n');
}
