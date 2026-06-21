import assert from 'node:assert/strict';
import { calculateResidentialBill, compareUsageScenarios, estimateBill, parseUsageRequest } from './billCalculator.js';
import {
  classifyCivilServiceCatalog,
  getKepcoIntegrationStatus,
  guideCivilService,
  listKepcoCivilServiceCatalog,
  prepareApplicationDraft
} from './civilService.js';
import { planEvChargingVisit } from './evCharging.js';

const bill = calculateResidentialBill({
  monthlyKwh: 350,
  voltageType: 'low_voltage',
  season: 'other'
});
assert.equal(bill.estimatedTotalWon, 70640, '350kWh low-voltage other-season sample should match KEPCO ON-style estimate');

const parsed = parseUsageRequest({
  text: '월 350kWh 쓰는데 제습기 300W를 매일 10시간 한 달 쓰면 얼마나 더 나와?'
});
assert.equal(parsed.applianceName, '제습기');
assert.equal(parsed.powerW, 300);
assert.equal(parsed.hoursPerDay, 10);
assert.equal(parsed.daysPerMonth, 30);
assert.equal(parsed.baseMonthlyKwh, 350);

const estimate = estimateBill({
  text: '월 350kWh 쓰는데 제습기 300W를 매일 10시간 한 달 쓰면 얼마나 더 나와?'
});
assert.equal(estimate.additionalMonthlyKwh, 90);
assert.ok(typeof estimate.increaseWon === 'number' && estimate.increaseWon > 0);

const scenarios = compareUsageScenarios({
  text: '월 350kWh 쓰고 에어컨 1800W를 비교해줘',
  scenarioHoursPerDay: [4, 8, 12, 24],
  daysPerMonth: 30
});
assert.equal(scenarios.scenarios.length, 4);
assert.equal(scenarios.scenarios[0]?.additionalMonthlyKwh, 216);

const catalog = listKepcoCivilServiceCatalog();
assert.equal(catalog.total, 63, 'KEPCO ON civil-service catalog should contain 63 items');

const facilityRefund = classifyCivilServiceCatalog('시설부담금 환불 대상금액 조회는 어디 민원이야?', 3);
assert.equal(facilityRefund.matches[0]?.labelKo, '시설부담금 환불 대상금액 조회');
assert.equal(facilityRefund.matches[0]?.boundary, 'needs_user_auth_or_api');

const ami = classifyCivilServiceCatalog('원격검침 AMI 신청하고 싶어', 3);
assert.equal(ami.matches[0]?.labelKo, '원격검침(AMI)신청');

const outage = guideCivilService({
  text: '집 앞 전선에서 스파크가 나고 정전된 것 같아'
});
assert.equal(outage.serviceType, 'outage_or_danger_report');
assert.equal(outage.canAutoSubmit, false);

const draft = prepareApplicationDraft({
  text: '이사정산 신청서 초안을 만들어줘',
  address: '서울시 예시구 예시로 1',
  preferredDate: '2026-07-01'
});
assert.equal(draft.canSubmit, false);
assert.equal(draft.serviceType, 'move_settlement');
assert.ok(draft.missingInputs.includes('신청자 성명'));

const evPlan = planEvChargingVisit({
  text: '30분 뒤 영동고속도로 강릉방향에서 40kWh 충전하고 싶어'
});
assert.equal(evPlan.parsed.arrivalInMinutes, 30);
assert.equal(evPlan.parsed.desiredKwh, 40);
assert.ok(evPlan.planA);
assert.equal(evPlan.reservationBoundary.integrationBoundary, 'needs_partner_agreement');

const integration = getKepcoIntegrationStatus();
assert.equal(integration.civilServiceCatalog.total, 63);
assert.ok(integration.availableNow.some((item) => item.includes('전기요금')));
assert.ok(integration.needsPartnerAgreement.some((item) => item.includes('충전')));

console.log('Smoke tests passed');
