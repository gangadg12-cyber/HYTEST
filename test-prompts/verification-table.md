# KEPCO Electric Life Agent Verification Table

| No | Prompt Target | Expected Tool | Expected Result |
| --- | --- | --- | --- |
| 1 | Appliance monthly bill increase | `estimate_residential_electricity_bill` | kWh formula, marginal or before/after estimate, tariff disclaimer |
| 2 | Existing monthly kWh + appliance | `estimate_residential_electricity_bill` | before bill, after bill, increase won |
| 3 | Pure monthly kWh bill | `estimate_residential_electricity_bill` | `currentBill` and `currentBillSummary`; 350kWh residential low-voltage other-season total close to 70,640 won with itemized basis |
| 4 | Usage optimization | `compare_electricity_usage_scenarios` | scenario table by hours/day or days/month; asks for missing daily hours when only day counts are provided |
| 5 | 63-item civil-service match | `classify_kepco_civil_service_63` | ranked 한전ON civil-service candidates with category and boundary |
| 6 | Civil-service catalog | `list_kepco_civil_service_catalog` | default compact category summary; detailed items only when `includeDetails=true` |
| 7 | Move settlement | `guide_kepco_civil_service` | `answerSummary`, required inputs, documents, 한전ON path |
| 8 | Application fill-out | `prepare_kepco_application_draft` | `answerSummary`, draft fields, missing inputs, no real submission claim |
| 9 | Auto-transfer | `guide_kepco_civil_service` | explains authenticated final action required |
| 10 | Dangerous facility report | `guide_kepco_civil_service` | 123/119 priority language |
| 11 | EV charging visit plan | `plan_ev_charging_visit` | With `EV_CHARGER_SERVICE_KEY`, location/zcode/coordinates trigger public API lookup; otherwise `liveApi` explains fallback |
| 12 | EV connector exact match | `plan_ev_charging_visit` | CHAdeMO request must not recommend DC Combo as Plan A/B |
| 13 | MVP capability | `get_kepco_mcp_integration_status` | available vs needs-auth vs needs-partner list, including demo/provided-candidate EV boundary |
| 14 | Official data inventory | `get_official_data_sources` | Markdown summary with KEPCO ON, form pages, public data, and EV charger API URLs; OCPP link is not shown |

## Manual Regression Prompts

```text
월 350kWh 쓰는데 에어컨 1800W를 하루 8시간 한 달 쓰면 얼마나 늘어?
월 350kWh 쓰면 주택용 저압 기준 전기요금이 얼마야?
1500W 제품을 하루 2시간씩 10일, 20일, 30일 쓰는 경우 비교해줘.
시설부담금 환불 대상금액 조회는 어디 민원이야?
한전ON 민원신청 63건 중 증설 관련 항목만 상세로 보여줘.
원격검침 AMI 신청서 초안 만들어줘.
30분 뒤 영동고속도로 강릉방향에서 40kWh 충전하고 싶어. 플랜A/B 추천해줘.
서울 강남구 근처에서 지금 사용 가능한 DC콤보 충전소를 찾아서 방문 플랜 짜줘.
영동고속도로 강릉방향에서 차데모 충전소만 찾아줘. DC콤보는 빼줘.
이 MCP가 실제 납부나 충전소 예약 확정까지 가능한지 기능 경계를 알려줘.
```
