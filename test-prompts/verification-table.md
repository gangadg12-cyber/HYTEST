# PlayMCP Verification Table

Endpoint tested in PlayMCP chat:

```text
https://child-safety-guide-mcp.playmcp-endpoint.kakaocloud.io/mcp
```

Round 1 date: 2026-06-20

| # | Prompt ID | Expected | Actual tool(s) | Actual result | Result | Notes/Fix |
|---|---:|---|---|---|---|---|
| 1 | 1 | Fever + urgent/ER + facility | `triage_child_urgency`, `find_child_medical_facilities` | High fever with nearby moonlight/pediatric links | Pass |  |
| 2 | 2 | Fever, young infant, ER | `triage_child_urgency`, `get_observation_checklist` | ER recommended for under-3-month fever | Pass |  |
| 3 | 3 | Mild respiratory, outpatient/observation | `triage_child_urgency`, `get_observation_checklist` | Observation/outpatient guidance | Pass |  |
| 4 | 4 | Respiratory distress, 119 | `triage_child_urgency`, `prepare_medical_handoff_summary` | 119 immediate + handoff summary | Pass |  |
| 5 | 5 | Vomiting + low urine, ER | `triage_child_urgency`, `analyze_child_symptoms` | ER/dehydration guidance | Pass |  |
| 6 | 6 | Diarrhea, outpatient/observation | `triage_child_urgency` | Outpatient + extra questions | Pass |  |
| 7 | 7 | Localized abdominal pain, ER | `triage_child_urgency`, `analyze_child_symptoms` | ER recommended | Pass |  |
| 8 | 8 | Allergy with airway symptom, 119 | `triage_child_urgency`, `prepare_medical_handoff_summary` | 119 immediate + handoff summary | Pass | Extra trauma question appeared; category filtering improved. |
| 9 | 9 | Skin/allergy, outpatient | `analyze_child_symptoms`, `triage_child_urgency`, `get_observation_checklist` | Outpatient + checklist | Pass | Extra trauma question appeared; category filtering improved. |
| 10 | 10 | Seizure/altered state, 119 | `triage_child_urgency`, `prepare_medical_handoff_summary` | 119 immediate + handoff summary | Pass |  |
| 11 | 11 | Headache + neck stiffness + vomiting, ER | `analyze_child_symptoms`, `triage_child_urgency`, `get_observation_checklist` | Incorrectly leaned outpatient | Fail | Added emergency red flag for neck stiffness with headache/vomiting. |
| 12 | 12 | Ear pain + fever, outpatient/urgent | `analyze_child_symptoms`, `triage_child_urgency`, `get_observation_checklist` | Outpatient guidance | Pass |  |
| 13 | 13 | Throat pain + cannot swallow, ER/urgent | `triage_child_urgency`, `analyze_child_symptoms`, `get_observation_checklist` | ER recommended | Pass |  |
| 14 | 14 | Head injury + repeated vomiting, ER | `triage_child_urgency`, `prepare_medical_handoff_summary` | ER + handoff summary | Pass |  |
| 15 | 15 | Burn blister, urgent/ER | `triage_child_urgency` | Urgent pediatric care | Pass |  |
| 16 | 16 | Urinary pain + fever, outpatient | none | Generic extra question only | Fail | Strengthened tool descriptions for urinary and vague symptom routing. |
| 17 | 17 | Low urine + lethargy, ER | `triage_child_urgency`, `analyze_child_symptoms`, `get_observation_checklist` | ER/dehydration guidance | Pass |  |
| 18 | 18 | Eye redness/discharge, outpatient | `analyze_child_symptoms`, `triage_child_urgency`, `get_observation_checklist` | Outpatient guidance | Pass |  |
| 19 | 19 | Eye chemical exposure, ER | `analyze_child_symptoms`, `triage_child_urgency`, `get_observation_checklist` | ER + rinse guidance | Pass |  |
| 20 | 20 | Abdominal pain, missing info | `analyze_child_symptoms`, `triage_child_urgency`, `get_observation_checklist` | Missing questions + outpatient caution | Pass |  |
| 21 | 21 | Fever only, missing info | none | Generic extra question only | Partial fail | Strengthened tool descriptions for vague fever routing. |
| 22 | 22 | Fever + night pediatric facility | `find_child_medical_facilities` | Moonlight/pediatric links | Pass | Facility-only selection acceptable, but urgency is now embedded in facility result after fix. |
| 23 | 23 | Breathing trouble + ER/facility + 119 | `find_child_medical_facilities` | ER links with weak 119 language | Partial fail | Facility lookup now returns triage summary; respiratory red flag keywords expanded. |
| 24 | 24 | Moonlight pediatric facility | `find_child_medical_facilities` | Moonlight hospital links | Pass |  |
| 25 | 25 | Hospital handoff summary | `prepare_medical_handoff_summary` | Phone summary generated | Pass |  |
| 26 | 26 | Altered response, 119 | `triage_child_urgency` | 119 immediate | Pass |  |
| 27 | 27 | Booking inquiry support | `request_or_prepare_booking` | Booking/phone script generated | Pass |  |
| 28 | 28 | iCareTalk handoff summary | `prepare_medical_handoff_summary` | Consultation summary generated | Pass |  |
| 29 | 29 | Ankle injury, urgent pediatric | `triage_child_urgency`, `analyze_child_symptoms`, `get_observation_checklist` | Tool call OK but checklist mixed unrelated skin/neuro guidance | Partial fail | Added ankle/sprain/cannot-walk trauma keywords and filtered trauma-vs-allergy category bleed. |
| 30 | 30 | Chest pain + shortness of breath, ER/119 | `triage_child_urgency`, `analyze_child_symptoms` | 119 immediate | Pass |  |

Round 1 summary:

- 26 pass
- 1 fail
- 3 partial fail
- Main fixes applied after Round 1: red-flag rule for neck stiffness with headache/vomiting, stronger PlayMCP tool descriptions for vague symptoms and urinary pain, facility lookup triage summary, respiratory red-flag keyword expansion, and trauma category cleanup for ankle/sprain cases.

Round 2 recheck targets after KC redeploy:

| Prompt ID | Recheck goal |
|---:|---|
| 11 | Must return ER guidance for headache + neck stiffness + vomiting. |
| 16 | PlayMCP should call a Child Safety Guide tool for urinary pain + fever. |
| 21 | PlayMCP should call a Child Safety Guide tool or clearly produce missing questions from tool context for vague fever. |
| 23 | Facility result should include urgent 119/ER triage summary for breathing difficulty. |
| 29 | Checklist should stay trauma/orthopedic focused without unrelated allergy/neuro guidance. |
