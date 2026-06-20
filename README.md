# KEPCO Electric Agent MCP Server

PlayMCP in KC ready Streamable HTTP MCP server for Korean electricity bill simulation and KEPCO civil-service preparation.

This server is an MVP for a natural-language KEPCO/한전ON work agent. It estimates residential electricity bill changes, compares appliance usage scenarios, classifies common KEPCO civil-service requests, prepares application drafts, and hands users off to official KEPCO/한전ON pages.

It does **not** perform real KEPCO login, payment, auto-transfer registration, or civil-service submission.

## Tools

- `parse_electricity_usage_request`
- `estimate_residential_electricity_bill`
- `compare_electricity_usage_scenarios`
- `classify_kepco_civil_service`
- `guide_kepco_civil_service`
- `prepare_kepco_application_draft`
- `get_kepco_mcp_integration_status`

## MVP Scope

Available now:

- Appliance power/time/day natural-language parsing
- Monthly kWh increase calculation
- Residential low/high-voltage bill estimate using deterministic tariff blocks
- Civil-service routing for 명의변경, 이사정산, 전기사용신청, 증설, 자동이체, 청구서 변경, 복지할인, 고장/위험설비 신고
- Required-input and likely-document checklist
- KEPCO/한전ON draft request text
- Official handoff links

Needs authenticated KEPCO or partner integration later:

- Real customer bill lookup
- Real payment
- Real auto-transfer registration
- Real civil-service submission
- AMI/customer-specific real-time usage lookup

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
에어컨을 하루 4시간, 8시간, 12시간 쓰는 경우 비교해줘.
이사정산 하려는데 어떤 정보가 필요해?
사업장 전기사용 신규 신청서 초안 작성해줘.
자동이체 신청은 MCP가 실제로 해줄 수 있어?
```

## Tariff Basis

The MVP uses built-in residential tariff blocks based on KEPCO residential tariff references and returns the basis date/source in every estimate. It is an approximate calculator. Actual bills can differ due to discounts, TV fees, meter reading dates, public charges, fuel adjustment, climate/environment charge, and contract-specific details. Official confirmation must be done through KEPCO/한전ON.
