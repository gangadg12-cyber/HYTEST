import type { RoutedIntentType } from './requestRouter.js';

export interface RouterRegressionQuestion {
  id: string;
  text: string;
  expectedIntents: RoutedIntentType[];
}

export const ROUTER_REGRESSION_QUESTIONS: RouterRegressionQuestion[] = [
  { id: 'bill-001', text: '우리집 이번 달 350kWh 썼으면 전기요금 얼마 정도 나와?', expectedIntents: ['electric_bill', 'home_usage_comparison'] },
  { id: 'bill-002', text: '900W 전자레인지 매일 10분 쓰면 한 달 전기세 얼마나 늘었을까?', expectedIntents: ['usage_comparison'] },
  { id: 'bill-003', text: '제습기 300W 하루 10시간 틀면 요금이 얼마야?', expectedIntents: ['electric_bill'] },
  { id: 'bill-004', text: '7월에 460kWh 쓰면 주택용 전기요금 계산해줘', expectedIntents: ['electric_bill'] },
  { id: 'bill-005', text: '1500와트 히터를 하루 2시간 20일 쓰면 얼마 나와?', expectedIntents: ['electric_bill'] },
  { id: 'bill-006', text: '전기차 집밥으로 한 달 120kWh 더 쓰면 요금 얼마나 늘었을까?', expectedIntents: ['usage_comparison'] },
  { id: 'bill-007', text: '냉장고를 새로 사면 전기요금 차이가 클까 80kWh 정도 늘면?', expectedIntents: ['usage_comparison'] },
  { id: 'usage-001', text: '250kWh랑 350kWh 전기요금 차이 비교해줘', expectedIntents: ['usage_comparison'] },
  { id: 'usage-002', text: '월 350kWh에서 80kWh 줄이면 얼마나 아껴?', expectedIntents: ['usage_comparison'] },
  { id: 'usage-003', text: '에어컨 1800와트를 4시간 8시간 12시간 쓰는 시나리오 비교해줘', expectedIntents: ['usage_comparison'] },
  { id: 'usage-004', text: '건조기 1회 2kWh 한 달 20번이면 요금 얼마나 늘었어?', expectedIntents: ['usage_comparison'] },
  { id: 'usage-005', text: '이번 달 420kWh인데 우리집 평균보다 많이 쓰는 편이야?', expectedIntents: ['home_usage_comparison'] },
  { id: 'usage-006', text: '4인가구 평균이 300kWh라면 우리 집 520kWh는 얼마나 높은 거야?', expectedIntents: ['home_usage_comparison'] },
  { id: 'usage-007', text: '600W 제품을 하루 몇 시간까지 쓰면 400kWh 안 넘을까?', expectedIntents: ['usage_comparison'] },
  { id: 'usage-008', text: '450kWh랑 500kWh 청구요금 비교하면 얼마나 차이나?', expectedIntents: ['usage_comparison'] },

  { id: 'civil-001', text: '한전 명의변경 신청하려면 뭐 준비해야 돼?', expectedIntents: ['civil_service'] },
  { id: 'civil-002', text: '이사정산 신청서 초안 만들어줘', expectedIntents: ['civil_service'] },
  { id: 'civil-003', text: '전기사용신청 신규로 해야 하는데 어떤 서류가 필요해?', expectedIntents: ['civil_service'] },
  { id: 'civil-004', text: '계약전력 증설 민원은 한전ON 어디서 해?', expectedIntents: ['civil_service'] },
  { id: 'civil-005', text: '자동이체 계좌 바꾸는 민원 FAQ 알려줘', expectedIntents: ['civil_service'] },
  { id: 'civil-006', text: '청구서 이메일로 받게 바꾸려면 신청서에 뭘 적어?', expectedIntents: ['civil_service'] },
  { id: 'civil-007', text: '복지할인 대상인지 확인하고 신청하려면 어떤 정보가 필요해?', expectedIntents: ['civil_service'] },
  { id: 'civil-008', text: '집 앞 전선에서 불꽃이 나고 정전됐는데 한전 민원으로 처리돼?', expectedIntents: ['civil_service'] },
  { id: 'civil-009', text: '고객번호를 모를 때 한전ON에서 어떻게 찾는지 알려줘', expectedIntents: ['civil_service'] },
  { id: 'civil-010', text: '시설부담금 환불 대상금액 조회는 무슨 민원으로 들어가?', expectedIntents: ['civil_service'] },

  { id: 'ev-001', text: '아이오닉5로 서울 강남구 근처 급속 충전소 찾아줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-002', text: 'EV6 타고 30분 뒤 영동고속도로 강릉방향 급속 충전소에서 40kWh 충전하고 싶어', expectedIntents: ['ev_charging'] },
  { id: 'ev-003', text: '모델Y인데 DC콤보 가능한 충전기만 방문 플랜 짜줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-004', text: '차데모 충전소가 필요한 구형 레이EV 충전소 안내해줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-005', text: '덕평휴게소 근처 전기차 충전 예약 가능한지 플랜B까지 봐줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-006', text: '부산 해운대 근처 완속 말고 급속 충전소 현재 사용 가능한 곳 있어?', expectedIntents: ['ev_charging'] },
  { id: 'ev-007', text: '서울에서 대전 가는 길에 100kW 이상 충전기 추천해줘', expectedIntents: ['ev_charging'] },
  { id: 'ev-008', text: '충전소 도착이 45분 뒤인데 지금 사용 가능 상태 기준으로 방문 플랜 세워줘', expectedIntents: ['ev_charging'] },

  { id: 'renew-001', text: '태양광 발전해서 판매하려면 REC랑 SMP가 뭐고 수익은 어떻게 계산해?', expectedIntents: ['renewable_sale'] },
  { id: 'renew-002', text: '100kW 태양광 판매 수익을 SMP 140원 REC 7만원으로 계산해줘', expectedIntents: ['renewable_sale'] },
  { id: 'renew-003', text: '분산전원 계통연계 여유용량 확인하려면 어떤 주소 정보가 필요해?', expectedIntents: ['renewable_sale'] },
  { id: 'renew-004', text: '신재생 판매 PPA랑 상계거래 차이를 알려줘', expectedIntents: ['renewable_sale'] },
  { id: 'renew-005', text: '태양광 REC 가중치가 수익에 얼마나 영향이 있어?', expectedIntents: ['renewable_sale'] },
  { id: 'renew-006', text: '발전사업으로 팔려면 한전 계약현황이랑 계통 정보를 같이 봐야 하나?', expectedIntents: ['renewable_sale'] },

  { id: 'solar-001', text: '우리집 옥상에 3kW 태양광 패널 설치하면 발전량 얼마나 나와?', expectedIntents: ['solar_region', 'home_usage_comparison'] },
  { id: 'solar-002', text: '서울 강남구는 태양광 자가소비로 전기요금 절약이 될까?', expectedIntents: ['solar_region'] },
  { id: 'solar-003', text: 'kw당 하루 3.5kWh 발전하면 5kW 설비 월 발전량 계산해줘', expectedIntents: ['solar_region'] },
  { id: 'solar-004', text: '일사량 정보 기준으로 패널 설치 적합한 지역인지 봐줘', expectedIntents: ['solar_region'] },

  { id: 'weather-001', text: '폭염이라 에어컨 많이 틀 것 같은데 전기요금 위험 알려줘', expectedIntents: ['weather_power'] },
  { id: 'weather-002', text: '한파 때 히터 1500W 하루 6시간 쓰면 요금 부담 클까?', expectedIntents: ['electric_bill', 'weather_power'] },
  { id: 'weather-003', text: '장마철 제습기 300W 계속 틀면 전기요금 조언해줘', expectedIntents: ['electric_bill', 'weather_power'] },
  { id: 'multi-001', text: '350kWh 쓰는 집인데 에어컨 1800W 추가 요금이랑 자동이체 민원도 같이 알려줘', expectedIntents: ['electric_bill', 'civil_service'] },
  { id: 'multi-002', text: '아이오닉5 충전소 찾고 태양광 판매 수익 계산도 같이 해줘', expectedIntents: ['ev_charging', 'renewable_sale'] },
  { id: 'multi-003', text: '이사정산 신청서 초안이랑 이사 후 300kWh 전기요금도 계산해줘', expectedIntents: ['civil_service', 'electric_bill'] },
  { id: 'multi-004', text: '태양광 5kW 설치 절감액이랑 REC 판매 가능성 같이 봐줘', expectedIntents: ['solar_region', 'renewable_sale'] }
];
