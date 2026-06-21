# Official Data Sources And Integration Boundaries

## Available In The MVP

| Feature | Official basis | MCP behavior |
| --- | --- | --- |
| Residential bill estimate | KEPCO ON tariff table and public residential tariff data | Deterministic tariff calculation with official-source disclaimer |
| Appliance usage simulation | User-provided W/kW/time plus tariff table | Additional monthly kWh and bill increase |
| Civil-service routing | KEPCO ON 민원신청 63-item catalog | Natural-language request to ranked civil-service candidates |
| Civil-service draft | KEPCO ON menu structure and FAQ public data | Required fields, likely documents, missing inputs, draft request text |
| Civil-service forms | KEPCO ON 서식자료실 and major 민원 pages | Official form URL, input-field guidance, and Markdown/text draft |
| EV charging visit plan | Korea Environment Corporation charger API structure and Korea Expressway rest-area charger data | Plan A/B based on current or provided candidate status and arrival time |

## Needs User Auth Or KEPCO API

These actions touch personal contract, billing, payment, or application data.

- Customer-number based bill lookup.
- Real payment.
- Auto-transfer registration/change.
- Name-change final submission.
- New electricity-use application final submission.
- Move settlement final submission and payment.
- Welfare discount application final submission.
- Customer AMI or real usage history lookup.
- Civil-service progress lookup for a specific customer/application.

The MCP prepares a payload-like draft and official path, but does not submit.

## Civil-Service Forms And File Return

The MVP can point users to official form and submission-guide pages such as:

- [한전ON 서식자료실](https://online.kepco.co.kr/CUM083D00)
- [한전ON 전기사용신청(신규) 안내](https://online.kepco.co.kr/MIM028D00)
- [한전ON 전기사용 변경(증설등) 안내](https://online.kepco.co.kr/MIM043D00)
- [전기사용신청 접수서 예시](https://home.kepco.co.kr/kepco/front/html/CY/F/A/CYFAPP0018103.pop3.html)

Current implementation returns official URLs, required inputs, likely documents, missing fields, and a Korean draft request. It does not yet generate a filled PDF/DOCX.

MCP standard tool results can represent resource links or embedded resource contents, so a later version can generate a document file and return an HTTPS link or resource response. PlayMCP's exact file-download user experience still needs separate validation, so the MVP avoids depending on that behavior.

## Needs Partner Agreement

These actions require an external operator to reserve or control a physical charging session.

- Confirmed EV charger reservation.
- Blocking non-reserved users at the charger.
- CPO account, payment, and membership integration.
- OCPP `ReserveNow`/`CancelReservation` or provider-specific equivalent.
- Reservation no-show, delay, and cancel policy enforcement.

The MVP therefore implements "reservation-style visit planning" rather than "confirmed reservation".

## Data Update Notes

- Tariff data should be refreshed when KEPCO changes rates, climate/environment charge, or fuel adjustment charge.
- KEPCO ON civil-service catalog should be checked before final submission because menu names can change.
- EV charger status needs live public API or CPO API data in production. Demo candidates are only for PlayMCP behavior testing.
- EV connector matching must be exact. A CHAdeMO request must not recommend a DC Combo charger as Plan A or Plan B.
