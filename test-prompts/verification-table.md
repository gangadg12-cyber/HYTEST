# KEPCO Agent Verification Table

| No | Prompt Target | Expected Tool | Expected Result |
| --- | --- | --- | --- |
| 1 | Appliance monthly bill increase | `estimate_residential_electricity_bill` | kWh formula, marginal or before/after estimate, tariff disclaimer |
| 2 | Existing monthly kWh + appliance | `estimate_residential_electricity_bill` | before bill, after bill, increase won |
| 3 | Usage optimization | `compare_electricity_usage_scenarios` | scenario table by hours/day |
| 4 | Move settlement | `guide_kepco_civil_service` | required inputs, documents, 한전ON path |
| 5 | Application fill-out | `prepare_kepco_application_draft` | draft fields, missing inputs, no real submission claim |
| 6 | Auto-transfer | `guide_kepco_civil_service` | explains authenticated final action required |
| 7 | Dangerous facility report | `guide_kepco_civil_service` | 123/119 priority language |
| 8 | MVP capability | `get_kepco_mcp_integration_status` | available vs needs-auth list |
