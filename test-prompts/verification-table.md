# KEPCO Electric Life Agent Verification Table

| No | Prompt Target | Expected Tool | Expected Result |
| --- | --- | --- | --- |
| 1 | Appliance monthly bill increase | `estimate_residential_electricity_bill` | kWh formula, marginal or before/after estimate, tariff disclaimer |
| 2 | Existing monthly kWh + appliance | `estimate_residential_electricity_bill` | before bill, after bill, increase won |
| 3 | KEPCO ON calculator parity sample | `estimate_residential_electricity_bill` | 350kWh residential low-voltage other-season total close to 70,640 won with itemized basis |
| 4 | Usage optimization | `compare_electricity_usage_scenarios` | scenario table by hours/day |
| 5 | 63-item civil-service match | `classify_kepco_civil_service_63` | ranked 한전ON civil-service candidates with category and boundary |
| 6 | Civil-service catalog | `list_kepco_civil_service_catalog` | total 63 items and categories |
| 7 | Move settlement | `guide_kepco_civil_service` | required inputs, documents, 한전ON path |
| 8 | Application fill-out | `prepare_kepco_application_draft` | draft fields, missing inputs, no real submission claim |
| 9 | Auto-transfer | `guide_kepco_civil_service` | explains authenticated final action required |
| 10 | Dangerous facility report | `guide_kepco_civil_service` | 123/119 priority language |
| 11 | EV charging visit plan | `plan_ev_charging_visit` | plan A/B, arrival-time reasoning, reservation boundary |
| 12 | MVP capability | `get_kepco_mcp_integration_status` | available vs needs-auth vs needs-partner list |
| 13 | Official data inventory | `get_official_data_sources` | KEPCO ON, public data, EV API, OCPP sources |

## Manual Regression Prompts

```text
월 350kWh 쓰는데 에어컨 1800W를 하루 8시간 한 달 쓰면 얼마나 늘어?
시설부담금 환불 대상금액 조회는 어디 민원이야?
원격검침 AMI 신청서 초안 만들어줘.
30분 뒤 영동고속도로 강릉방향에서 40kWh 충전하고 싶어. 플랜A/B 추천해줘.
이 MCP가 실제 납부나 충전소 예약 확정까지 가능한지 기능 경계를 알려줘.
```
