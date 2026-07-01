import assert from 'node:assert/strict';
import { calculateResidentialBill, compareUsageScenarios, estimateBill, parseUsageRequest } from './billCalculator.js';
import {
  classifyCivilServiceCatalog,
  getKepcoIntegrationStatus,
  guideCivilService,
  listKepcoCivilServiceCatalog,
  prepareApplicationDraft
} from './civilService.js';
import {
  inferEvConnectorFromVehicleModel,
  inferEvZcode,
  inferEvZscode,
  mapKepcoChargerManageItemToCandidate,
  planEvChargingVisit,
  planEvChargingVisitWithLiveData
} from './evCharging.js';
import { compareHomeElectricityUsage } from './homeUsage.js';
import { getOfficialDataSourcesResult } from './kepcoData.js';
import { getApiReadiness, getPublicApis } from './publicApis.js';
import { handleElectricLifeRequest } from './requestRouter.js';
import { ROUTER_REGRESSION_QUESTIONS } from './routerQuestionSet.js';
import { analyzeRenewableEnergySale } from './renewableSale.js';
import { checkSolarRegion } from './solar.js';
import { adviseWeatherPowerUsage } from './weatherPower.js';

const bill = calculateResidentialBill({
  monthlyKwh: 350,
  voltageType: 'low_voltage',
  season: 'other'
});
assert.equal(bill.estimatedTotalWon, 70640, '350kWh low-voltage other-season sample should match KEPCO ON-style estimate');

const pureBill = estimateBill({
  text: '월 350kWh 쓰면 주택용 저압 기준 얼마야?',
  billingMonth: 6
});
assert.equal(pureBill.currentBill?.estimatedTotalWon, 70640);
assert.ok(pureBill.currentBillSummary?.includes('70,640원'));
assert.ok(pureBill.userFacingSummary.length > 0);
assert.equal(pureBill.parsed.applianceName, undefined);
assert.deepEqual(pureBill.parsed.missingFields, []);

const casualMonthlyBill = estimateBill({
  text: '우리집 이번 달 350kWh 썼으면 전기요금 얼마 정도 나와?',
  billingMonth: 6
});
assert.equal(casualMonthlyBill.currentBill?.estimatedTotalWon, 70640);
assert.deepEqual(casualMonthlyBill.parsed.missingFields, []);

const dryerPerUse = estimateBill({
  text: '건조기 1회 2kWh 한 달 20번 쓰면 요금 얼마나 늘어?'
});
assert.equal(dryerPerUse.additionalMonthlyKwh, 40);
assert.equal(dryerPerUse.parsed.perUseKwh, 2);
assert.equal(dryerPerUse.parsed.usesPerMonth, 20);

const dryerPerUseWithBase = estimateBill({
  text: '월 350kWh 쓰는데 건조기 1회 2kWh 한 달 20번 쓰면 얼마나 더 나와?'
});
assert.equal(dryerPerUseWithBase.parsed.baseMonthlyKwh, 350);
assert.equal(dryerPerUseWithBase.additionalMonthlyKwh, 40);
assert.ok(typeof dryerPerUseWithBase.increaseWon === 'number' && dryerPerUseWithBase.increaseWon > 0);

const microwaveMinutes = estimateBill({
  text: '900W 전자레인지 매일 10분 쓰면 한 달 전기요금 얼마나 늘어?'
});
assert.equal(microwaveMinutes.additionalMonthlyKwh, 4.5);

const koreanWattUnit = estimateBill({
  text: '1500와트 제품 하루 2시간 10일 쓰면 얼마나 늘어?'
});
assert.equal(koreanWattUnit.parsed.powerW, 1500);
assert.equal(koreanWattUnit.additionalMonthlyKwh, 30);

const reducedUsage = estimateBill({
  text: '월 350kWh에서 80kWh 줄이면 전기요금 얼마나 아껴?'
});
assert.equal(reducedUsage.additionalMonthlyKwh, -80);
assert.equal(reducedUsage.afterBill?.monthlyKwh, 270);
assert.ok(typeof reducedUsage.increaseWon === 'number' && reducedUsage.increaseWon < 0);

const monthlyKwhComparison = compareUsageScenarios({
  text: '250kWh랑 350kWh 차이가 얼마야?'
});
assert.equal(monthlyKwhComparison.usageBillComparisons?.length, 2);
assert.ok((monthlyKwhComparison.usageBillComparisons?.[1]?.differenceFromPreviousWon ?? 0) > 0);

const reducedUsageScenario = compareUsageScenarios({
  text: '350kWh에서 80kWh 줄이면 얼마나 아껴?'
});
assert.equal(reducedUsageScenario.usageBillComparisons, undefined);
assert.equal(reducedUsageScenario.directIncreaseScenarios?.length, 1);
assert.equal(reducedUsageScenario.directIncreaseScenarios?.[0]?.afterMonthlyKwh, 270);

const previousMonthIncreaseScenario = compareUsageScenarios({
  text: '지난달보다 65kWh 더 쓰면 얼마나 늘어? 지난달은 310kWh였어'
});
assert.equal(previousMonthIncreaseScenario.usageBillComparisons, undefined);
assert.equal(previousMonthIncreaseScenario.directIncreaseScenarios?.length, 1);
assert.equal(previousMonthIncreaseScenario.directIncreaseScenarios?.[0]?.assumedBaseMonthlyKwh, 310);
assert.equal(previousMonthIncreaseScenario.directIncreaseScenarios?.[0]?.afterMonthlyKwh, 375);

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

const dryerMissingUsage = estimateBill({
  text: '소비전력은 모르는데 건조기 한 달 쓰면 대략 계산 가능해?'
});
assert.equal(dryerMissingUsage.parsed.applianceName, '의류건조기');
assert.equal(dryerMissingUsage.parsed.powerW, 1200);
assert.ok(dryerMissingUsage.parsed.missingFields.includes('하루 사용시간'));
assert.ok(dryerMissingUsage.clarifyingQuestions.some((question) => question.includes('하루 사용시간')));

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
assert.ok(missingDayScenarioHour.clarifyingQuestions.some((question) => question.includes('하루 사용시간')));
assert.ok(missingDayScenarioHour.recommendations[0]?.includes('하루 사용시간'));

const catalog = listKepcoCivilServiceCatalog();
assert.equal(catalog.total, 63, 'KEPCO ON civil-service catalog should contain 63 items');
assert.equal(catalog.includeDetails, false);
assert.equal(catalog.items, undefined);
assert.ok(catalog.summaryText.includes('건'));

const catalogDetails = listKepcoCivilServiceCatalog({ includeDetails: true, limit: 5 });
assert.equal(catalogDetails.items?.length, 5);

const contractExpansion = listKepcoCivilServiceCatalog({ query: '증설', includeDetails: true, limit: 10 });
assert.ok(contractExpansion.items?.some((item) => item.labelKo.includes('증설')));

const facilityRefund = classifyCivilServiceCatalog('시설부담금 환불 대상금액 조회는 어디 민원이야?', 3);
assert.equal(facilityRefund.matches[0]?.labelKo, '시설부담금 환불 대상금액 조회');
assert.equal(facilityRefund.matches[0]?.boundary, 'needs_user_auth_or_api');

const ami = classifyCivilServiceCatalog('원격검침 AMI 신청하고 싶어', 3);
assert.ok(ami.matches[0]?.labelKo.includes('AMI'));

const meterCheck = classifyCivilServiceCatalog('계량기 숫자가 이상한 것 같아서 확인 요청하고 싶어', 3);
assert.equal(meterCheck.matches[0]?.labelKo, '전력량계 점검 및 교환신청');

const termination = guideCivilService({
  text: '가게 폐업해서 전기 사용을 그만두려면 신청서에 뭘 써야 해?'
});
assert.equal(termination.serviceType, 'contract_termination');
assert.equal(termination.labelKo, '계약 해지');

const terminationWithUnpaidBill = guideCivilService({
  text: '전기 사용 해지하면서 미납요금 확인은 어떻게 해야 해?'
});
assert.equal(terminationWithUnpaidBill.serviceType, 'contract_termination');

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
assert.ok(draft.userFacingSummary.length <= 4);
assert.ok(draft.fieldGuide.customerNumber.includes('전기사용계약'));

const evPlan = planEvChargingVisit({
  text: '30분 뒤 영동고속도로 강릉방향에서 40kWh 충전하고 싶어',
  candidates: [
    {
      name: '테스트 휴게소 전기차 충전소',
      address: '영동고속도로 테스트휴게소',
      routeName: '영동고속도로',
      direction: '강릉방향',
      connectorType: 'DC콤보',
      outputKw: 100,
      status: 'available',
      availableCount: 2,
      totalCount: 3,
      statusUpdatedAt: '20260624090000'
    }
  ]
});
assert.equal(evPlan.parsed.arrivalInMinutes, 30);
assert.equal(evPlan.parsed.desiredKwh, 40);
assert.ok(evPlan.planA);
assert.equal(evPlan.dataMode, 'provided_candidates');
assert.equal(evPlan.reservationBoundary.integrationBoundary, 'needs_partner_agreement');
assert.ok(evPlan.officialDataSources.some((source) => source.id === 'kepco_ev_charge_manage_api'));
assert.ok(!evPlan.officialDataSources.some((source) => source.id === 'ocpp_standard'));
assert.ok(evPlan.userFacingSummary.length > 0);

const ioniqConnector = inferEvConnectorFromVehicleModel('아이오닉5로 충전소 찾아줘');
assert.equal(ioniqConnector?.connectorType, 'DC콤보');
assert.equal(inferEvConnectorFromVehicleModel('포터2 EV 충전소 찾아줘')?.connectorType, 'DC콤보');
assert.equal(inferEvConnectorFromVehicleModel('신형 레이 EV 급속 충전')?.connectorType, 'DC콤보');
assert.equal(inferEvConnectorFromVehicleModel('레이EV 구형 차데모 충전소')?.connectorType, 'CHAdeMO');

const evPlanByVehicleModel = planEvChargingVisit({
  text: '아이오닉5로 서울 강남구 근처 급속 충전소 찾아줘',
  candidates: [
    {
      name: '강남 테스트 충전소',
      address: '서울특별시 강남구 테헤란로 1',
      connectorType: 'DC콤보',
      outputKw: 100,
      status: 'available',
      availableCount: 1,
      totalCount: 1,
      statusUpdatedAt: '20260624090000'
    }
  ]
});
assert.equal(evPlanByVehicleModel.parsed.vehicleConnector?.vehicleModel, '현대 아이오닉 5');
assert.equal(evPlanByVehicleModel.parsed.connectorType, 'DC콤보');
assert.ok(evPlanByVehicleModel.planA);

assert.equal(inferEvZcode('서울 강남구'), '11');
assert.deepEqual(inferEvZscode('서울 강남구'), { zcode: '11', zscode: '11680' });
const liveCandidate = mapKepcoChargerManageItemToCandidate(
  {
    csNm: '강남 테스트 충전소',
    cpNm: '급속01',
    addr: '서울특별시 강남구 테헤란로 1',
    lat: '37.4979',
    longi: '127.0276',
    cpTp: '07',
    chargeTp: '2',
    cpStat: '1',
    statUpdatedatetime: '20260621101010'
  },
  { latitude: 37.5, longitude: 127.03 }
);
assert.equal(liveCandidate?.connectorType, 'DC콤보');
assert.equal(liveCandidate?.status, 'available');
assert.ok(typeof liveCandidate?.distanceKm === 'number');

const liveDisabled = await planEvChargingVisitWithLiveData({
  locationText: '서울 강남구',
  connectorType: 'DC콤보',
  useLiveApi: false
});
assert.equal(liveDisabled.dataMode, 'unavailable');
assert.equal(liveDisabled.candidates.length, 0);
assert.equal(liveDisabled.planA, undefined);
assert.ok(Array.isArray(liveDisabled.clarifyingQuestions));
assert.ok(liveDisabled.visitPlanText.includes('임의 충전소'));

const routeOnlyEvPlan = await planEvChargingVisitWithLiveData({
  text: '서해안고속도로 목포방면으로 가는 중인데 30분 뒤 충전 플랜 잡아줘',
  vehicleModel: '아이오닉5',
  desiredKwh: 40,
  useLiveApi: false
});
assert.equal(routeOnlyEvPlan.dataMode, 'unavailable');
assert.ok(routeOnlyEvPlan.clarifyingQuestions[0]?.includes('현재 지나고 있는 IC/휴게소'));
assert.equal(routeOnlyEvPlan.parsed.direction, '목포방향');

const chademoPlan = planEvChargingVisit({
  text: '30분 뒤 영동고속도로 강릉방향에서 차데모 충전소만 찾아줘',
  candidates: [
    {
      name: 'DC콤보 전용 테스트 충전소',
      connectorType: 'DC콤보',
      outputKw: 100,
      status: 'available',
      availableCount: 1,
      totalCount: 1,
      statusUpdatedAt: '20260624090000'
    }
  ]
});
assert.equal(chademoPlan.parsed.connectorType, 'CHAdeMO');
assert.equal(chademoPlan.planA, undefined);
assert.ok(chademoPlan.candidates.every((candidate) => candidate.recommendation === 'avoid'));
assert.ok(chademoPlan.visitPlanText.includes('정확히 일치'));

const integration = getKepcoIntegrationStatus();
assert.equal(integration.civilServiceCatalog.total, 63);
assert.ok(integration.availableNow.some((item) => item.includes('전기요금')));
assert.ok(integration.needsPartnerAgreement.some((item) => item.includes('충전')));

assert.ok(integration.publicApis.some((api) => api.code === 'S3'));
assert.ok(integration.apiReadiness.some((api) => api.code === 'W1'));

const weatherUnavailable = await adviseWeatherPowerUsage({
  text: 'weather based power advice',
  useLiveApi: false
});
assert.equal(weatherUnavailable.dataMode, 'unavailable');
assert.equal(weatherUnavailable.riskLevel, 'unknown');
assert.ok(weatherUnavailable.userFacingSummary.length > 0);
assert.ok(weatherUnavailable.clarifyingQuestions.length > 0);

const weatherProvided = await adviseWeatherPowerUsage({
  temperatureC: 35,
  alertType: 'heat_wave',
  baseMonthlyKwh: 350,
  powerW: 1500,
  hoursPerDay: 6,
  daysPerMonth: 30,
  useLiveApi: false
});
assert.equal(weatherProvided.dataMode, 'user_provided');
assert.equal(weatherProvided.riskLevel, 'high');
assert.ok(weatherProvided.userFacingSummary.length > 0);
assert.ok(typeof weatherProvided.billScenario?.increaseWon === 'number');

const publicWeatherApis = getPublicApis({ feature: 'weather_power_advisor' });
assert.ok(publicWeatherApis.some((api) => api.code === 'W1'));
assert.ok(getApiReadiness({ feature: 'solar_region_checker' }).some((api) => api.code === 'S3'));

const renewableUnavailable = await analyzeRenewableEnergySale({
  text: '태양광 팔려면 뭐가 필요해?',
  useLiveApi: false
});
assert.equal(renewableUnavailable.dataMode, 'unavailable');
assert.ok(renewableUnavailable.userFacingSummary.length > 0);
assert.ok(renewableUnavailable.clarifyingQuestions.length > 0);

const renewableProvided = await analyzeRenewableEnergySale({
  text: '100kW 태양광 판매 수익 계산',
  expectedAnnualGenerationKwh: 130000,
  smpWonPerKwh: 140,
  recPriceWonPerRec: 70000,
  recWeight: 1.2,
  useLiveApi: false
});
assert.equal(renewableProvided.dataMode, 'user_provided');
assert.equal(renewableProvided.revenueEstimate?.estimatedAnnualRevenueWon, 29120000);
assert.ok(renewableProvided.userFacingSummary.some((line) => line.includes('예상 연 매출')));

const renewableDailyToMonthly = await analyzeRenewableEnergySale({
  text: '하루 25kWh 발전하고 SMP 120원, REC 8만원이면 월 수익 대략 얼마야?',
  expectedAnnualGenerationKwh: 25,
  smpWonPerKwh: 120,
  recPriceWonPerRec: 80000,
  useLiveApi: false
});
assert.equal(renewableDailyToMonthly.parsed.generationInputPeriod, 'daily');
assert.equal(renewableDailyToMonthly.parsed.expectedAnnualGenerationKwh, 9125);
assert.equal(renewableDailyToMonthly.revenueEstimate?.estimatedAnnualRevenueWon, 1825000);
assert.equal(renewableDailyToMonthly.revenueEstimate?.estimatedMonthlyRevenueWon, 152083);
assert.ok(renewableDailyToMonthly.userFacingSummary.some((line) => line.includes('예상 월 매출')));

const renewableContractStatus = await analyzeRenewableEnergySale({
  text: '서울 강서구에 태양광 계약된 설비가 얼마나 있는지 공식 데이터로 볼 수 있어?',
  useLiveApi: false
});
assert.equal(renewableContractStatus.parsed.requestType, 'contract_status');
assert.ok(!renewableContractStatus.clarifyingQuestions.some((line) => /SMP|REC|발전량/.test(line)));

const renewableGrid = await analyzeRenewableEnergySale({
  text: '강원 원주에 50kW 태양광을 하려는데 아직 번지는 몰라. 계통연계 확인 가능해?',
  useLiveApi: false
});
assert.equal(renewableGrid.parsed.requestType, 'grid_interconnection');
assert.ok(renewableGrid.clarifyingQuestions.some((line) => line.includes('동') || line.includes('지번') || line.includes('변전소')));
assert.ok(!renewableGrid.clarifyingQuestions.some((line) => /SMP|REC/.test(line)));

const homeUsageUnavailable = compareHomeElectricityUsage({ monthlyKwh: 420 });
assert.equal(homeUsageUnavailable.dataMode, 'unavailable');
assert.equal(homeUsageUnavailable.comparison, undefined);
assert.ok(homeUsageUnavailable.userFacingSummary.length > 0);
assert.ok(homeUsageUnavailable.clarifyingQuestions.length > 0);

const homeUsageProvided = compareHomeElectricityUsage({
  monthlyKwh: 420,
  benchmarkMonthlyKwh: 300,
  benchmarkLabel: 'test benchmark'
});
assert.equal(homeUsageProvided.dataMode, 'user_provided');
assert.equal(homeUsageProvided.comparison?.level, 'very_high');
assert.ok(homeUsageProvided.userFacingSummary.length > 0);
assert.ok(homeUsageProvided.answerSummary.includes('420'));

const solarUnavailable = checkSolarRegion({ solarCapacityKw: 3, currentMonthlyKwh: 420 });
assert.equal(solarUnavailable.dataMode, 'unavailable');
assert.equal(solarUnavailable.suitability, 'needs_data');
assert.ok(solarUnavailable.userFacingSummary.length > 0);
assert.ok(solarUnavailable.clarifyingQuestions.length > 0);

const solarProvided = checkSolarRegion({
  solarCapacityKw: 3,
  averageDailyGenerationKwhPerKw: 3.5,
  currentMonthlyKwh: 420
});
assert.equal(solarProvided.dataMode, 'user_provided');
assert.equal(solarProvided.generation?.expectedMonthlyGenerationKwh, 315);
assert.ok(solarProvided.userFacingSummary.length > 0);
assert.ok(typeof solarProvided.billSaving?.estimatedSavingWon === 'number');

const routedBillAndEv = await handleElectricLifeRequest({
  text: '우리집 350kWh 쓰는데 건조기 1회 2kWh 한 달 20번 쓰면 요금 얼마나 늘고, 서울 강남구 근처 DC콤보 충전소도 찾아줘',
  locationText: '서울 강남구',
  connectorType: 'DC콤보',
  useLiveApi: false
});
assert.ok(routedBillAndEv.intents.some((intent) => intent.type === 'usage_comparison' || intent.type === 'electric_bill'));
assert.ok(routedBillAndEv.intents.some((intent) => intent.type === 'ev_charging'));
assert.ok(Array.isArray(routedBillAndEv.nextQuestions));
assert.ok(routedBillAndEv.userFacingSummary.length > 0);

const routedCivilAndRenewable = await handleElectricLifeRequest({
  text: '태양광 판매 수익도 계산하고 한전 명의변경 신청서에 뭘 적어야 하는지도 알려줘',
  expectedAnnualGenerationKwh: 130000,
  smpWonPerKwh: 140,
  recPriceWonPerRec: 70000,
  useLiveApi: false
});
assert.ok(routedCivilAndRenewable.intents.some((intent) => intent.type === 'renewable_sale'));
assert.ok(routedCivilAndRenewable.intents.some((intent) => intent.type === 'civil_service'));
assert.ok(routedCivilAndRenewable.userFacingSummary.length > 0);

const routedEvCivilService = await handleElectricLifeRequest({
  text: '전기차 충전소 사용량 제출 민원은 한전ON 어디서 해?',
  useLiveApi: false
});
assert.ok(routedEvCivilService.intents.some((intent) => intent.type === 'civil_service'));

assert.equal(ROUTER_REGRESSION_QUESTIONS.length, 50);
for (const question of ROUTER_REGRESSION_QUESTIONS) {
  const routed = await handleElectricLifeRequest({
    text: question.text,
    useLiveApi: false
  });
  for (const expectedIntent of question.expectedIntents) {
    assert.ok(
      routed.intents.some((intent) => intent.type === expectedIntent),
      `${question.id} should include ${expectedIntent}; got ${routed.intents.map((intent) => intent.type).join(', ')}`
    );
  }
  assert.ok(routed.userFacingSummary.length > 0, `${question.id} should return userFacingSummary`);
}

const sources = getOfficialDataSourcesResult();
assert.ok(sources.markdownSummary.includes('https://online.kepco.co.kr/CUM083D00'));
assert.ok(sources.markdownSummary.includes('https://www.data.go.kr/data/15147132/openapi.do'));
assert.ok(!sources.markdownSummary.includes('openchargealliance'));
assert.ok(sources.fileReturnNote.includes('MCP 표준'));

console.log('Smoke tests passed');
