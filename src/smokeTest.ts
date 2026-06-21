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
import { getOfficialDataSourcesResult } from './kepcoData.js';

const bill = calculateResidentialBill({
  monthlyKwh: 350,
  voltageType: 'low_voltage',
  season: 'other'
});
assert.equal(bill.estimatedTotalWon, 70640, '350kWh low-voltage other-season sample should match KEPCO ON-style estimate');

const pureBill = estimateBill({
  text: '월 350kWh 쓰면 주택용 저압 기준 얼마야?'
});
assert.equal(pureBill.currentBill?.estimatedTotalWon, 70640);
assert.ok(pureBill.currentBillSummary?.includes('70,640원'));

const julyBill = estimateBill({
  text: '7월에 460kWh 쓰면 전기요금이 얼마나 나와?'
});
assert.equal(julyBill.parsed.season, 'summer');
assert.ok(typeof julyBill.currentBill?.estimatedTotalWon === 'number');

const parsed = parseUsageRequest({
  text: '월 350kWh 쓰는데 제습기 300W를 매일 10시간 쓰면 얼마 더 나오지?'
});
assert.equal(parsed.applianceName, '제습기');
assert.equal(parsed.powerW, 300);
assert.equal(parsed.hoursPerDay, 10);
assert.equal(parsed.daysPerMonth, 30);
assert.equal(parsed.baseMonthlyKwh, 350);

const estimate = estimateBill({
  text: '월 350kWh 쓰는데 제습기 300W를 매일 10시간 쓰면 얼마 더 나오지?'
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

const dayScenarios = compareUsageScenarios({
  text: '1500W 제품을 하루 2시간씩 10일, 20일, 30일 쓰는 경우 비교해줘'
});
assert.equal(dayScenarios.scenarios.length, 3);
assert.equal(dayScenarios.scenarios[0]?.daysPerMonth, 10);
assert.equal(dayScenarios.scenarios[0]?.additionalMonthlyKwh, 30);

const missingDayScenarioHour = compareUsageScenarios({
  text: '1500W 제품을 10일, 20일, 30일 쓰는 경우 비교 가능해?'
});
assert.equal(missingDayScenarioHour.scenarios.length, 0);
assert.ok(missingDayScenarioHour.recommendations[0]?.includes('하루 사용시간'));

const catalog = listKepcoCivilServiceCatalog();
assert.equal(catalog.total, 63, 'KEPCO ON civil-service catalog should contain 63 items');
assert.equal(catalog.includeDetails, false);
assert.equal(catalog.items, undefined);
assert.ok(catalog.summaryText.includes('건'));

const catalogDetails = listKepcoCivilServiceCatalog({ includeDetails: true, limit: 5 });
assert.equal(catalogDetails.items?.length, 5);

const facilityRefund = classifyCivilServiceCatalog('시설부담금 환불 대상금액 조회는 어디 민원이야?', 3);
assert.equal(facilityRefund.matches[0]?.labelKo, '시설부담금 환불 대상금액 조회');
assert.equal(facilityRefund.matches[0]?.boundary, 'needs_user_auth_or_api');

const ami = classifyCivilServiceCatalog('원격검침 AMI 신청하고 싶어', 3);
assert.ok(ami.matches[0]?.labelKo.includes('AMI'));

const outage = guideCivilService({
  text: '집 앞 전선에서 스파크가 나고 정전된 것 같아'
});
assert.equal(outage.serviceType, 'outage_or_danger_report');
assert.equal(outage.canAutoSubmit, false);
assert.ok(outage.answerSummary.includes('공식 경로'));
assert.ok(!outage.missingInputs.includes('고객번호 또는 사용장소 주소'));

const draft = prepareApplicationDraft({
  text: '이사정산 신청서 초안을 만들어줘',
  address: '서울시 예시구 예시로 1',
  preferredDate: '2026-07-01'
});
assert.equal(draft.canSubmit, false);
assert.equal(draft.serviceType, 'move_settlement');
assert.ok(draft.missingInputs.includes('신청자 성명'));
assert.ok(draft.answerSummary.includes('최종 신청'));

const evPlan = planEvChargingVisit({
  text: '30분 뒤 영동고속도로 강릉방향에서 40kWh 충전하고 싶어'
});
assert.equal(evPlan.parsed.arrivalInMinutes, 30);
assert.equal(evPlan.parsed.desiredKwh, 40);
assert.ok(evPlan.planA);
assert.equal(evPlan.reservationBoundary.integrationBoundary, 'needs_partner_agreement');

const chademoPlan = planEvChargingVisit({
  text: '30분 뒤 영동고속도로 강릉방향에서 차데모 충전소만 찾아줘'
});
assert.equal(chademoPlan.parsed.connectorType, 'CHAdeMO');
assert.equal(chademoPlan.planA, undefined);
assert.ok(chademoPlan.candidates.every((candidate) => candidate.recommendation === 'avoid'));
assert.ok(chademoPlan.visitPlanText.includes('정확히 일치'));

const integration = getKepcoIntegrationStatus();
assert.equal(integration.civilServiceCatalog.total, 63);
assert.ok(integration.availableNow.some((item) => item.includes('전기요금')));
assert.ok(integration.needsPartnerAgreement.some((item) => item.includes('충전')));

const sources = getOfficialDataSourcesResult();
assert.ok(sources.markdownSummary.includes('https://online.kepco.co.kr/CUM083D00'));
assert.ok(sources.fileReturnNote.includes('MCP 표준'));

console.log('Smoke tests passed');
