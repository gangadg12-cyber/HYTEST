export type UrgencyLevel =
  | 'call_119_now'
  | 'emergency_room'
  | 'urgent_pediatric_care'
  | 'outpatient_pediatrics'
  | 'home_observation';

export interface SymptomCategory {
  id: string;
  labelKo: string;
  labelEn: string;
  keywords: string[];
  bodyParts: string[];
  specialties: string[];
  observationGuide: string[];
  warningSignals: string[];
}

export interface RedFlagRule {
  id: string;
  labelKo: string;
  urgency: UrgencyLevel;
  keywords: string[];
  reason: string;
  action: string;
}

export const SERVICE_NAME = 'Child Safety Guide';
export const SERVICE_NAME_KO = '소아안심가이드';

export const DISCLAIMER =
  '이 안내는 진단이나 처방이 아니라 증상 정리와 의료기관 연결을 돕는 참고 정보입니다. 아이 상태가 급격히 나빠지거나 보호자가 위험하다고 느끼면 즉시 119 또는 가까운 응급실을 이용하세요.';

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  call_119_now: '119 즉시',
  emergency_room: '응급실 권장',
  urgent_pediatric_care: '야간/휴일 소아진료 권장',
  outpatient_pediatrics: '소아과 외래 권장',
  home_observation: '자가 관찰 + 악화 신호 확인'
};

export const URGENCY_RANK: Record<UrgencyLevel, number> = {
  home_observation: 1,
  outpatient_pediatrics: 2,
  urgent_pediatric_care: 3,
  emergency_room: 4,
  call_119_now: 5
};

export const BODY_PART_KEYWORDS: Record<string, string[]> = {
  head: ['머리', '두통', '이마', '뒤통수'],
  neck: ['목', '목덜미', '목이 뻣뻣'],
  chest: ['가슴', '흉통'],
  abdomen: ['배', '복통', '명치', '아랫배', '오른쪽 아랫배'],
  skin: ['피부', '발진', '두드러기', '가려움', '물집'],
  ear: ['귀', '귓속'],
  eye: ['눈', '눈곱', '충혈'],
  throat: ['목아픔', '인후통', '목이 아파'],
  breathing: ['숨', '호흡', '쌕쌕', '기침'],
  limb: ['팔', '다리', '손', '발', '발목', '손목']
};

export const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  {
    id: 'fever',
    labelKo: '발열/감염 의심',
    labelEn: 'Fever or infection-like symptoms',
    keywords: ['열', '고열', '발열', '체온', '오한', '몸살', '춥다', '뜨거워'],
    bodyParts: ['head', 'throat'],
    specialties: ['소아청소년과', '응급의학과'],
    observationGuide: [
      '체온을 다시 측정하고 아이의 활동성, 수분 섭취, 소변량을 같이 확인하세요.',
      '열 자체보다 의식, 호흡, 탈수, 경련 같은 동반 신호가 더 중요합니다.'
    ],
    warningSignals: [
      '3개월 미만 영아의 38도 이상 발열',
      '경련, 의식 저하, 호흡곤란 동반',
      '수분 섭취가 거의 없거나 소변이 현저히 줄어듦'
    ]
  },
  {
    id: 'respiratory',
    labelKo: '호흡기 증상',
    labelEn: 'Respiratory symptoms',
    keywords: ['기침', '콧물', '가래', '숨', '호흡', '쌕쌕', '숨차', '천명', '폐렴'],
    bodyParts: ['breathing', 'chest', 'throat'],
    specialties: ['소아청소년과', '이비인후과', '응급의학과'],
    observationGuide: [
      '호흡수, 갈비뼈가 들어가는지, 입술색, 말하거나 울 수 있는지를 확인하세요.',
      '기침보다 숨쉬기 힘든 모습이 있는지가 긴급도 판단의 핵심입니다.'
    ],
    warningSignals: ['호흡곤란', '입술이나 얼굴이 파래짐', '축 처짐 또는 말/울음이 어려움']
  },
  {
    id: 'gastrointestinal',
    labelKo: '복통/구토/설사',
    labelEn: 'Abdominal pain, vomiting, or diarrhea',
    keywords: ['배', '복통', '구토', '토', '설사', '혈변', '변', '탈수', '메스꺼', '토했'],
    bodyParts: ['abdomen'],
    specialties: ['소아청소년과', '소아외과', '응급의학과'],
    observationGuide: [
      '구토/설사 횟수, 마지막 소변 시간, 물을 마실 수 있는지 확인하세요.',
      '통증 위치가 한쪽으로 고정되는지, 걷기 힘들 정도인지 살피세요.'
    ],
    warningSignals: ['혈변 또는 초록색 구토', '심한 탈수 의심', '오른쪽 아랫배 통증이 심하거나 걷기 어려움']
  },
  {
    id: 'skin_allergy',
    labelKo: '피부/알레르기 증상',
    labelEn: 'Skin rash or allergic symptoms',
    keywords: ['발진', '두드러기', '가려', '붓', '부어', '알레르기', '물집', '입술', '얼굴'],
    bodyParts: ['skin'],
    specialties: ['소아청소년과', '피부과', '응급의학과'],
    observationGuide: [
      '발진이 퍼지는 속도, 얼굴/입술 부종, 호흡 증상 동반 여부를 확인하세요.',
      '새 음식, 약, 벌레 물림, 감염 후 발생했는지 정리하세요.'
    ],
    warningSignals: ['호흡곤란을 동반한 두드러기', '입술/혀/얼굴 부종', '의식 저하 또는 반복 구토 동반']
  },
  {
    id: 'neurologic',
    labelKo: '신경계/의식 관련 증상',
    labelEn: 'Neurologic or consciousness-related symptoms',
    keywords: ['경련', '발작', '의식', '깨워도', '반응', '축 처', '두통', '어지', '목이 뻣뻣'],
    bodyParts: ['head', 'neck'],
    specialties: ['응급의학과', '소아청소년과', '소아신경과'],
    observationGuide: [
      '경련이 있었다면 시작/종료 시각, 지속시간, 의식 회복 여부를 기록하세요.',
      '두통은 반복 구토, 목 경직, 의식 변화가 함께 있는지 확인하세요.'
    ],
    warningSignals: ['현재 경련 중이거나 반복 경련', '의식 저하 또는 반응 없음', '심한 두통과 목 경직/반복 구토']
  },
  {
    id: 'ear_nose_throat',
    labelKo: '귀/코/목 증상',
    labelEn: 'Ear, nose, or throat symptoms',
    keywords: ['귀', '중이염', '목아픔', '인후통', '콧물', '코막힘', '목이 아파'],
    bodyParts: ['ear', 'throat'],
    specialties: ['소아청소년과', '이비인후과'],
    observationGuide: [
      '통증 위치, 열 동반 여부, 삼킴 곤란, 귀에서 분비물이 나오는지 확인하세요.',
      '숨쉬기 어려움이나 침을 삼키지 못하는 증상이 있으면 긴급도가 올라갑니다.'
    ],
    warningSignals: ['침을 삼키지 못함', '호흡곤란', '목이 붓고 고열이 심함']
  },
  {
    id: 'trauma_burn',
    labelKo: '외상/화상',
    labelEn: 'Trauma, injury, or burn',
    keywords: [
      '넘어',
      '떨어',
      '부딪',
      '다쳤',
      '찢어',
      '출혈',
      '화상',
      '골절',
      '삐었',
      '삐끗',
      '접질',
      '못 걷',
      '못걸',
      '못 걸',
      '데었',
      '데임',
      '뜨거운'
    ],
    bodyParts: ['head', 'limb', 'skin'],
    specialties: ['응급의학과', '정형외과', '소아외과'],
    observationGuide: [
      '다친 시간, 부위, 출혈 여부, 움직일 수 있는지, 머리 충격 여부를 확인하세요.',
      '화상은 부위, 크기, 물집 여부, 얼굴/손/생식기 침범 여부가 중요합니다.'
    ],
    warningSignals: ['머리 외상 후 의식 변화/반복 구토', '지혈되지 않는 출혈', '넓은 화상 또는 얼굴/기도 부위 화상']
  },
  {
    id: 'ingestion_poisoning',
    labelKo: '약물/이물/중독 의심',
    labelEn: 'Possible ingestion, foreign body, or poisoning',
    keywords: ['약을 잘못', '약 먹', '삼켰', '먹은 것 같', '세제 먹', '건전지', '동전', '농약', '독성'],
    bodyParts: ['abdomen', 'throat'],
    specialties: ['응급의학과', '소아청소년과'],
    observationGuide: [
      '먹은 물질, 양, 시간, 포장지/약봉지를 보관하고 바로 의료기관에 문의하세요.',
      '토하게 하거나 임의로 물/우유를 먹이기 전에 119 또는 의료진 지시를 받으세요.'
    ],
    warningSignals: ['약물/세제/건전지/자석/날카로운 물체 섭취 의심', '구토, 침 흘림, 호흡곤란, 의식 변화 동반']
  },
  {
    id: 'urinary',
    labelKo: '소변/비뇨기 증상',
    labelEn: 'Urinary symptoms',
    keywords: ['소변', '오줌', '배뇨', '요로', '소변볼 때', '피오줌'],
    bodyParts: ['abdomen'],
    specialties: ['소아청소년과', '비뇨의학과'],
    observationGuide: [
      '소변 시 통증, 소변 횟수, 열 동반 여부, 옆구리 통증을 확인하세요.',
      '고열과 축 처짐이 함께 있으면 당일 진료가 필요할 수 있습니다.'
    ],
    warningSignals: ['고열과 옆구리 통증', '소변이 거의 나오지 않음', '혈뇨와 심한 통증']
  },
  {
    id: 'eye',
    labelKo: '눈 증상',
    labelEn: 'Eye symptoms',
    keywords: ['눈', '충혈', '눈곱', '시야', '눈부심', '눈통증'],
    bodyParts: ['eye'],
    specialties: ['소아청소년과', '안과'],
    observationGuide: [
      '눈 통증, 시야 변화, 외상 여부, 분비물 양과 색을 확인하세요.',
      '화학물질 노출이나 외상 후 시야 이상은 긴급 진료가 필요합니다.'
    ],
    warningSignals: ['시야 변화', '심한 눈 통증', '화학물질 노출 또는 날카로운 물체 외상']
  }
];

export const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: 'respiratory_distress',
    labelKo: '호흡곤란/청색증',
    urgency: 'call_119_now',
    keywords: [
      '호흡곤란',
      '숨을 못',
      '숨을 잘 못',
      '숨을잘못',
      '숨쉬기 힘',
      '숨쉬기 어려',
      '숨 쉬기 어려',
      '숨이 차',
      '숨이차',
      '입술이 파',
      '얼굴이 파',
      '청색증',
      '갈비뼈가 들어'
    ],
    reason: '호흡곤란이나 청색증은 빠른 응급평가가 필요한 위험신호입니다.',
    action: '아이를 편한 자세로 두고 즉시 119에 연락하세요.'
  },
  {
    id: 'active_seizure_or_unresponsive',
    labelKo: '경련/의식 저하',
    urgency: 'call_119_now',
    keywords: ['경련', '발작', '의식 없음', '반응 없음', '반응이 이상', '깨워도 안', '기절'],
    reason: '경련, 의식 저하, 반응 없음은 지연 없이 응급 대응이 필요합니다.',
    action: '경련 시간을 기록하고, 입에 아무것도 넣지 말고, 즉시 119에 연락하세요.'
  },
  {
    id: 'anaphylaxis_possible',
    labelKo: '중증 알레르기 의심',
    urgency: 'call_119_now',
    keywords: ['아나필락시스', '두드러기와 숨', '입술 붓고 숨', '혀가 붓'],
    reason: '호흡 증상을 동반한 알레르기 반응은 빠르게 악화될 수 있습니다.',
    action: '즉시 119에 연락하고, 처방받은 응급약이 있다면 보호자가 지시받은 대로 사용하세요.'
  },
  {
    id: 'severe_dehydration',
    labelKo: '심한 탈수 의심',
    urgency: 'emergency_room',
    keywords: ['소변이 안', '소변을 안', '소변이 거의', '하루종일 거의', '눈물이 안', '입이 바짝', '못 마셔', '계속 토'],
    reason: '수분 섭취가 안 되고 소변이 줄면 탈수 평가가 필요합니다.',
    action: '가까운 응급실 또는 야간 소아진료기관으로 이동을 고려하세요.'
  },
  {
    id: 'bloody_or_bilious_vomit_stool',
    labelKo: '혈변/초록색 구토',
    urgency: 'emergency_room',
    keywords: ['혈변', '피 섞인 변', '피 토', '초록색 구토', '초록 토'],
    reason: '혈변이나 담즙성 구토는 응급 평가가 필요한 복부 질환 신호일 수 있습니다.',
    action: '음식 섭취를 무리하게 시키지 말고 응급실 진료를 권장합니다.'
  },
  {
    id: 'head_injury_warning',
    labelKo: '머리 외상 후 위험신호',
    urgency: 'emergency_room',
    keywords: ['머리 부딪', '머리 다쳤', '떨어져 머리', '머리 충격', '머리 외상'],
    reason: '머리 외상 뒤 반복 구토, 졸림, 의식 변화는 평가가 필요합니다.',
    action: '머리 외상 경위와 이후 증상을 정리해 응급실에 문의하거나 방문하세요.'
  },
  {
    id: 'severe_abdominal_pain',
    labelKo: '심한 복통/국소 복통',
    urgency: 'emergency_room',
    keywords: ['오른쪽 아랫배', '걷기 힘', '배가 딱딱', '배를 못 만지'],
    reason: '심한 국소 복통은 소아외과적 평가가 필요할 수 있습니다.',
    action: '진통제나 음식 섭취 전 의료기관에 문의하고 응급실 진료를 고려하세요.'
  },
  {
    id: 'serious_burn_or_bleeding',
    labelKo: '심한 화상/출혈',
    urgency: 'emergency_room',
    keywords: ['지혈 안', '피가 계속', '넓은 화상', '얼굴 화상', '전기 화상'],
    reason: '멈추지 않는 출혈, 넓은 화상, 얼굴/기도 화상은 빠른 처치가 필요합니다.',
    action: '출혈 부위는 압박하고, 화상은 흐르는 물로 식힌 뒤 응급실로 이동하세요.'
  },
  {
    id: 'cannot_swallow_or_drooling',
    labelKo: '침 삼킴 곤란/기도 위험',
    urgency: 'emergency_room',
    keywords: ['침을 못 삼', '침을 잘 못', '삼키지 못', '목이 부어 숨'],
    reason: '침을 삼키기 어렵거나 목 부종이 있으면 기도 문제가 동반될 수 있습니다.',
    action: '당일 즉시 진료 가능한 의료기관 또는 응급실에 문의/방문하세요.'
  },
  {
    id: 'chemical_eye_exposure',
    labelKo: '눈 화학물질 노출',
    urgency: 'emergency_room',
    keywords: ['눈에 세제', '눈에 화학', '세제가 들어', '화학물질이 들어'],
    reason: '눈에 세제나 화학물질이 들어간 경우 빠른 세척과 진료 판단이 필요합니다.',
    action: '흐르는 물로 씻기 시작하고, 119 또는 안과/응급실에 즉시 문의하세요.'
  },
  {
    id: 'possible_poisoning_or_foreign_body',
    labelKo: '약물/이물/중독 의심',
    urgency: 'call_119_now',
    keywords: ['약을 잘못', '약 먹은 것', '세제 먹', '건전지 삼', '자석 삼', '농약', '독성'],
    reason: '약물, 세제, 건전지, 자석 등 섭취 의심은 지체 없이 전문 상담이 필요합니다.',
    action: '먹은 물질과 포장지를 챙기고 즉시 119 또는 응급실에 문의하세요.'
  }
];
