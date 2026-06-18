# HYTEST MCP Server

Minimal Streamable HTTP MCP server prepared for PlayMCP in KC.

## Tools

- `get_server_time`
- `echo_message`
- `count_characters`

## Local Commands

```bash
npm install
npm run dev
```

The MCP endpoint is:

```text
http://localhost:3000/mcp
```

## Docker

```bash
docker build -t hytest-mcp-server .
docker run --rm -p 3000:3000 hytest-mcp-server
```

## PlayMCP in KC

Use Git source build with:

```text
Git URL: https://github.com/gangadg12-cyber/HYTEST.git
Branch/ref: main
Dockerfile path: Dockerfile
PAT: leave empty for a public repository
```

After the server becomes active, copy the Endpoint URL and register it in the PlayMCP console.
