# Official Data Sources And Integration Boundaries

## Available In The MVP

| Feature | Official basis | MCP behavior |
| --- | --- | --- |
| Residential bill estimate | KEPCO ON tariff table and public residential tariff data | Deterministic tariff calculation with official-source disclaimer |
| Appliance usage simulation | User-provided W/kW/time plus tariff table | Additional monthly kWh and bill increase |
| Civil-service routing | KEPCO ON 민원신청 63-item catalog | Natural-language request to ranked civil-service candidates |
| Civil-service draft | KEPCO ON menu structure and FAQ public data | Required fields, likely documents, missing inputs, draft request text |
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
