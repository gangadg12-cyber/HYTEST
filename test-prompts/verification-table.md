# PlayMCP Verification Table

Fill this table during PlayMCP chat validation.

| # | Prompt ID | Expected tool(s) | Expected urgency/category | Actual tool(s) | Actual result | Pass/Fail | Notes/Fix |
|---|---|---|---|---|---|---|---|
| 1 | 1 | `triage_child_urgency`, `find_child_medical_facilities` | fever, urgent/ER |  |  |  |  |
| 2 | 2 | `triage_child_urgency` | fever, ER |  |  |  |  |
| 3 | 3 | `triage_child_urgency`, `get_observation_checklist` | respiratory, outpatient/observation |  |  |  |  |
| 4 | 4 | `triage_child_urgency`, `prepare_medical_handoff_summary` | respiratory, 119 |  |  |  |  |
| 5 | 5 | `triage_child_urgency` | gastro, ER |  |  |  |  |
| 6 | 20 | `analyze_child_symptoms` | missing questions |  |  |  |  |
| 7 | 22 | `triage_child_urgency`, `find_child_medical_facilities` | fever + facility |  |  |  |  |
| 8 | 25 | `prepare_medical_handoff_summary` | handoff summary |  |  |  |  |
| 9 | 27 | `request_or_prepare_booking` | booking support |  |  |  |  |
| 10 | 31 | `triage_child_urgency` | possible poisoning, ER/119 |  |  |  |  |
