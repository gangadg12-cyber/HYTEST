# Child Safety Guide MCP Server

PlayMCP in KC ready Streamable HTTP MCP server for pediatric symptom structuring, rule-based urgency guidance, medical handoff summaries, and facility lookup support.

This server is not a diagnostic or prescribing system. It helps a caregiver organize child symptoms and connect to 119, emergency rooms, pediatric clinics, moonlight pediatric hospitals, or public consultation services.

## Tools

- `analyze_child_symptoms`
- `triage_child_urgency`
- `find_child_medical_facilities`
- `prepare_medical_handoff_summary`
- `get_observation_checklist`
- `request_or_prepare_booking`

## Safety Policy

- Do not provide a confirmed diagnosis.
- Do not provide prescription or medicine dosage instructions.
- Do not say that emergency care is unnecessary as a certainty.
- If red flags are present, prioritize 119 or emergency room guidance.
- Do not store child health data or location data in the MVP.

## Local Commands

```bash
npm install
npm run dev
```

The MCP endpoint is:

```text
http://localhost:3000/mcp
```

## Environment

Copy `.env.example` if you want live public data lookup.

```text
EGEN_SERVICE_KEY=
PUBLIC_DATA_SERVICE_KEY=
MCP_PORT=3000
```

Without `EGEN_SERVICE_KEY` or `PUBLIC_DATA_SERVICE_KEY`, facility lookup still returns official links, map search links, and booking/phone inquiry guidance. Live emergency room lookup uses a short timeout and a small in-memory cache so PlayMCP responses do not hang on slow public APIs.

## Docker

```bash
docker build -t child-safety-guide-mcp-server .
docker run --rm -p 3000:3000 child-safety-guide-mcp-server
```

## PlayMCP in KC

Use Git source build with:

```text
Git URL: https://github.com/gangadg12-cyber/HYTEST.git
Branch/ref: main
Dockerfile path: Dockerfile
PAT: leave empty for a public repository
```

After the server becomes active, copy the Endpoint URL and register it in the PlayMCP console. Use "정보 불러오기" to confirm all six tools are listed.

## Verification Flow

1. Check `/healthz`.
2. Run MCP `initialize`.
3. Run `tools/list`.
4. Run representative `tools/call` cases.
5. Register the endpoint in PlayMCP.
6. Run the prompts in `test-prompts/playmcp-child-triage-prompts.md`.
7. Compare PlayMCP output with the expected urgency/category in `test-prompts/verification-table.md`.
