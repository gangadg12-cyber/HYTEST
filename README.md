# KEPCO Electric Life Agent MCP Server

PlayMCP in KC ready Streamable HTTP MCP server for Korean electricity bill simulation, KEPCO/한전ON civil-service preparation, and EV charging visit planning.

This MVP is designed as a natural-language electricity life agent:

- Estimate household bill impact from appliance use.
- Compare electricity usage scenarios.
- Classify requests against the official 한전ON 민원신청 63-item catalog.
- Prepare civil-service form fields, missing inputs, likely documents, and official handoff paths.
- Plan EV charging visits using public charger status style data and arrival-time assumptions.
- Clearly separate what is available now from actions requiring login/API/partner agreement.

It does not perform real KEPCO login, payment, auto-transfer registration, civil-service submission, EV charging reservation confirmation, or EV charging payment.

## Tools

- `parse_electricity_usage_request`
- `estimate_residential_electricity_bill`
- `compare_electricity_usage_scenarios`
- `classify_kepco_civil_service`
- `classify_kepco_civil_service_63`
- `list_kepco_civil_service_catalog`
- `guide_kepco_civil_service`
- `prepare_kepco_application_draft`
- `plan_ev_charging_visit`
- `get_kepco_mcp_integration_status`
- `get_official_data_sources`

## Official Data Basis

| Area | Source | Use |
| --- | --- | --- |
| Electricity bill calculator | https://online.kepco.co.kr/PRM033D00 | Calculation verification |
| Tariff table | https://online.kepco.co.kr/PRM004D00 | Tariff blocks, VAT, power-industry fund basis |
| Residential tariff public data | https://www.data.go.kr/data/15090700/fileData.do | Residential low/high voltage tariff reference |
| Yearly tariff public data | https://www.data.go.kr/data/15090576/fileData.do | Tariff update reference |
| KEPCO ON FAQ | https://www.data.go.kr/data/3068685/fileData.do | Civil-service FAQ and task guidance |
| KEPCO ON civil-service catalog | https://online.kepco.co.kr/MIM001D00 | 63-item civil-service classification |
| EV charger public API | https://www.data.go.kr/data/15076352/openapi.do | Charger location/status structure |
| Expressway rest-area charger data | https://www.data.go.kr/data/15085543/fileData.do | Highway charging candidate planning |
| OCPP standard | https://openchargealliance.org/protocols/open-charge-point-protocol/ | Real reservation integration boundary |

## Function Boundaries

Available now:

- Appliance power/time/day natural-language parsing.
- Monthly kWh increase calculation.
- Residential low/high-voltage bill estimate using official tariff basis.
- Scenario comparison by use hours.
- Natural-language classification against 63 한전ON civil-service items.
- Required-input, likely-document, and missing-field checklist.
- KEPCO/한전ON draft request text and official path handoff.
- EV charging visit plan A/B using supplied charger candidates or demo candidates.

Needs KEPCO login, user auth, or official API:

- Customer-specific bill lookup.
- Real payment.
- Real auto-transfer registration/change.
- Final civil-service submission.
- Customer AMI/real-time usage lookup.
- 민원 처리현황 조회 tied to a real customer/application.

Needs partner agreement or CPO integration:

- Confirmed EV charging reservation.
- Blocking non-reserved users from a charger.
- CPO account/payment integration.
- OCPP `ReserveNow`/equivalent backend control.
- Reservation no-show/delay/cancel policy enforcement.

## Local Commands

```bash
npm install
npm run build
npm run dev
```

The MCP endpoint is:

```text
http://localhost:3000/mcp
```

Health check:

```text
http://localhost:3000/healthz
```

## Docker

```bash
docker build -t kepco-electric-agent-mcp-server .
docker run --rm -p 3000:3000 kepco-electric-agent-mcp-server
```

## PlayMCP in KC

Use Git source build with:

```text
MCP server name: kepco-electric-agent-mcp
Description: 한전 전기요금 계산, 한전ON 민원 63건 분류/신청서 준비, EV 충전 방문 플랜을 제공하는 전기생활 MCP입니다. 실제 로그인/납부/민원제출/충전예약 확정은 공식 API 또는 협약 연계가 필요합니다.
Git URL: https://github.com/gangadg12-cyber/HYTEST.git
Branch/ref: main
Dockerfile path: Dockerfile
PAT: leave empty for a public repository
```

After KC build/deploy, register the generated endpoint in PlayMCP and run "정보 불러오기" to refresh the tool list.

## Example Prompts

```text
에어컨 1800W짜리 하루 8시간씩 한 달 틀면 전기요금 얼마나 늘어?
월 350kWh 쓰는데 제습기 300W를 매일 10시간 쓰면 얼마나 더 나와?
에어컨을 하루 4시간, 8시간, 12시간, 24시간 쓰는 경우 비교해줘.
이사정산 하려는데 어떤 정보가 필요해?
명의변경 신청서 초안 작성해줘. 아직 고객번호는 몰라.
시설부담금 환불 대상금액 조회는 어떤 민원으로 분류돼?
한전ON 민원 63건 목록 보여줘.
30분 뒤 영동고속도로 강릉방향에서 40kWh 충전하고 싶어. 플랜A/B 추천해줘.
이 MCP가 지금 할 수 있는 것과 API/협약이 필요한 것을 구분해줘.
```

## Tariff Basis

The MVP uses residential tariff blocks based on KEPCO/한전ON references. It applies:

- Basic charge by residential low/high-voltage block.
- Energy charge by progressive block.
- Climate/environment charge.
- Fuel adjustment charge.
- VAT at 10%.
- Power-industry fund at 2.7%, rounded down to 10 won.
- Final billed amount rounded down to 10 won.

It is still an estimate. Official confirmation must be done through KEPCO/한전ON.
