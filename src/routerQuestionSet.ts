import type { RoutedIntentType } from './requestRouter.js';

export interface RouterRegressionQuestion {
  id: string;
  text: string;
  expectedIntents: RoutedIntentType[];
}

export const ROUTER_REGRESSION_QUESTIONS: RouterRegressionQuestion[] = [
  { id: 'bill-001', text: '이번 달 사용량이 360kWh면 전기요금이 대략 얼마야?', expectedIntents: ['electric_bill'] },
  { id: 'bill-002', text: '전자레인지 950와트를 매일 12분 쓰는 경우 요금 차이 비교해줘', expectedIntents: ['usage_comparison'] },
  { id: 'bill-003', text: '제습기 280W 하루 9시간이면 전기요금 계산해줘', expectedIntents: ['electric_bill'] },
  { id: 'bill-004', text: '8월 470kWh 주택용 저압 요금 알려줘', expectedIntents: ['electric_bill'] },
  { id: 'bill-005', text: '히터 1200와트 하루 3시간 15일 사용하면 전기세 얼마야?', expectedIntents: ['electric_bill'] },
  { id: 'bill-006', text: '집에서 전기차 충전으로 150kWh 더 썼을 때 얼마나 늘었어?', expectedIntents: ['usage_comparison'] },
  { id: 'bill-007', text: '김치냉장고 때문에 월 60kWh 늘면 요금 차이 얼마나 나?', expectedIntents: ['usage_comparison'] },
  { id: 'usage-001', text: '300kWh랑 420kWh 요금 차이 비교해줘', expectedIntents: ['usage_comparison'] },
  { id: 'usage-002', text: '월 사용량 500kWh에서 100kWh 줄이면 전기세 얼마나 아껴?', expectedIntents: ['usage_comparison'] },
  { id: 'usage-003', text: '에어컨 1600와트를 3시간 6시간 9시간 쓰는 경우 비교해줘', expectedIntents: ['usage_comparison'] },
  { id: 'usage-004', text: '건조기 한 번 1.8kWh씩 월 25회 쓰면 요금 얼마나 늘었어?', expectedIntents: ['usage_comparison'] },
  { id: 'usage-005', text: '우리집 390kWh인데 4인가구 평균보다 많이 쓰는 편이야?', expectedIntents: ['home_usage_comparison'] },
  { id: 'usage-006', text: '2인가구 평균 260kWh와 우리 집 410kWh 비교해줘', expectedIntents: ['usage_comparison', 'home_usage_comparison'] },
  { id: 'usage-007', text: '750W 기기를 몇 시간 쓰면 월 380kWh를 넘는지 시나리오 알려줘', expectedIntents: ['usage_comparison'] },
  { id: 'usage-008', text: '480kWh와 530kWh 청구요금 차이나는지 비교해줘', expectedIntents: ['usage_comparison'] },

  { id: 'civil-001', text: '명의를 바꾸려면 한전ON에서 어떤 정보가 필요해?', expectedIntents: ['civil_service'] },
  { id: 'civil-002', text: '이사 나갈 때 정산 신청서 문구 초안 잡아줘', expectedIntents: ['civil_service'] },
  { id: 'civil-003', text: '새 상가 전기사용신청 준비 서류 알려줘', expectedIntents: ['civil_service'] },
  { id: 'civil-004', text: '계약전력 올리는 증설 민원 경로 알려줘', expectedIntents: ['civil_service'] },
  { id: 'civil-005', text: '자동이체 카드로 바꾸는 FAQ 찾아줘', expectedIntents: ['civil_service'] },
  { id: 'civil-006', text: '종이 청구서를 모바일 청구서로 바꾸려면 양식에 뭐 적어?', expectedIntents: ['civil_service'] },
  { id: 'civil-007', text: '복지할인 신청 대상이면 필요한 서류가 뭐야?', expectedIntents: ['civil_service'] },
  { id: 'civil-008', text: '전봇대 쪽 스파크랑 정전이 있는데 어디 신고해야 해?', expectedIntents: ['civil_service'] },
  { id: 'civil-009', text: '고객번호 조회를 못하겠는데 한전ON 메뉴 알려줘', expectedIntents: ['civil_service'] },
  { id: 'civil-010', text: '전기요금 납부확인서 발급은 어떤 민원이야?', expectedIntents: ['civil_service'] },

  { id: 'ev-001', text: '아이오닉5 타는데 강남역 근처 급속 충전소 알려줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-002', text: 'EV6로 40분 뒤 영동고속도로 강릉방향 충전소 들를 계획 짜줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-003', text: '모델Y DC콤보 되는 충전기 위주로 플랜A 플랜B 잡아줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-004', text: '구형 레이EV 차데모 충전소만 골라줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-005', text: '덕평휴게소 전기차 충전 예약 말고 방문 플랜만 세워줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-006', text: '해운대 주변 급속 충전기 현재 비어있는 곳 찾아줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-007', text: '대전 가는 길에 100kW 이상 급속 충전소 추천해줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-008', text: '충전기 도착 예정이 45분 뒤라 대체 후보까지 보고 싶어', expectedIntents: ['ev_charging'] },

  { id: 'renew-001', text: '신재생 판매할 때 REC랑 SMP가 각각 뭔지 설명해줘', expectedIntents: ['renewable_sale'] },
  { id: 'renew-002', text: '연 130000kWh 생산하고 SMP 140원 REC 7만원이면 판매 수익 계산해줘', expectedIntents: ['renewable_sale'] },
  { id: 'renew-003', text: '분산전원 연계 여유용량 조회하려면 주소를 어디까지 넣어야 해?', expectedIntents: ['renewable_sale'] },
  { id: 'renew-004', text: 'PPA랑 상계거래 중 뭐가 다른지 비교해줘', expectedIntents: ['renewable_sale'] },
  { id: 'renew-005', text: 'REC 가격이 변하면 신재생 수익이 얼마나 달라져?', expectedIntents: ['renewable_sale'] },
  { id: 'renew-006', text: '발전사업 시작 전에 계통 정보랑 계약 현황을 같이 봐줘', expectedIntents: ['renewable_sale'] },

  { id: 'solar-001', text: '옥상 3kW 태양광 설치하면 월 발전량이 어느 정도야?', expectedIntents: ['solar_region'] },
  { id: 'solar-002', text: '부산 해운대 태양광 자가소비 적합한지 봐줘', expectedIntents: ['solar_region'] },
  { id: 'solar-003', text: 'kw당 하루 3.8kWh라면 4kW 태양광 월 발전량 계산해줘', expectedIntents: ['solar_region'] },
  { id: 'solar-004', text: '패널 설치 전 일사량 기준으로 입지 괜찮은지 체크해줘', expectedIntents: ['solar_region'] },

  { id: 'weather-001', text: '폭염 때 냉방비 위험도만 먼저 봐줘', expectedIntents: ['weather_power'] },
  { id: 'weather-002', text: '한파에 1800W 히터 하루 5시간 쓰면 전기요금 부담 봐줘', expectedIntents: ['electric_bill', 'weather_power'] },
  { id: 'weather-003', text: '장마라 제습기 350W 계속 켤 때 전기세 조언해줘', expectedIntents: ['electric_bill', 'weather_power'] },
  { id: 'multi-001', text: '월 360kWh 쓰는데 에어컨 1600W 추가 요금이랑 자동이체 변경도 알려줘', expectedIntents: ['electric_bill', 'civil_service'] },
  { id: 'multi-002', text: '아이오닉5 급속 충전소 찾고 신재생 판매 수익도 같이 봐줘', expectedIntents: ['ev_charging', 'renewable_sale'] },
  { id: 'multi-003', text: '이사정산 신청서 만들고 새집 320kWh 전기요금도 계산해줘', expectedIntents: ['civil_service', 'electric_bill'] },
  { id: 'multi-004', text: '태양광 5kW 설치 검토랑 REC 판매 가능성을 같이 정리해줘', expectedIntents: ['solar_region', 'renewable_sale'] }
];
