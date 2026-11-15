# universal-mcp-toolkit

A modular, cloud-deployable universal Model Context Protocol (MCP) server toolkit built for Cloudflare Workers.

`universal-mcp-toolkit` provides a stateless developer utility toolkit adhering to the official Model Context Protocol standard. It is designed to be client-agnostic, secure, and deployable within Cloudflare Workers free-tier allowances.

> **Important**: Every developer deploys their own independent instance into their own Cloudflare account and receives their own endpoint. There is no shared, centralized, or managed endpoint operated by the repository owner.

---

## Key Features

- **MCP-Standard**: Built using the official MCP TypeScript SDK and Streamable HTTP transport, designed for compatibility with MCP-compliant clients.
- **Independent Serverless Deployment**: Hosted on Cloudflare Workers for edge execution without managing physical or virtual servers.
- **Free-Tier Friendly**: Uses standard Web APIs (Web Crypto, URL, TextEncoder/TextDecoder). Zero paid dependencies, subscriptions, or external paid APIs.
- **Strict Validation**: All tool parameters are validated at runtime via Zod schemas.
- **Structured Error Handling**: Catches malformed input and returns structured MCP error responses (`isError: true`) without causing server crashes.
- **Modular Design**: Isolated tool definitions with centralized registration and automated unit and protocol tests.

---

## Available Tools

The toolkit exposes five stateless developer utility tools:

### 1. `json_format`

Format and validate JSON input with customizable indentation.

- **Inputs**:
    - `json` (_string_, required): Raw JSON string to format and validate.
    - `indent` (_integer_, optional, default `2`, range `0`–`8`): Number of spaces for indentation. `0` produces compact minified JSON.
- **Output**: Formatted JSON string or descriptive syntax error.

### 2. `base64_encode`

Encode text into Base64 format with full Unicode and emoji support.

- **Inputs**:
    - `text` (_string_, required): UTF-8 text to encode.
- **Output**: Base64-encoded string.

### 3. `base64_decode`

Decode Base64 strings into UTF-8 text with strict validation.

- **Inputs**:
    - `encoded` (_string_, required): Base64-encoded string.
- **Output**: Decoded UTF-8 string, or a structured error if the input contains invalid characters, incorrect padding, or invalid UTF-8 byte sequences.

### 4. `hash_text`

Generate a cryptographic hash using standard Web Crypto (`crypto.subtle.digest`).

- **Inputs**:
    - `text` (_string_, required): Text to hash.
    - `algorithm` (_enum_, optional, default `"SHA-256"`): Allowed options: `"SHA-256"`, `"SHA-384"`, `"SHA-512"`. Deprecated or weak algorithms (MD5, SHA-1) are rejected.
- **Output**: Lowercase hexadecimal hash string.

### 5. `url_parse`

Parse and inspect a URL without making outbound network requests.

- **Inputs**:
    - `url` (_string_, required): Absolute URL string to inspect.
- **Output**: Structured JSON containing:
    - `protocol`: URL scheme (e.g., `"https:"`)
    - `hostname`: Host name (e.g., `"example.com"`)
    - `port`: Port string (e.g., `"8080"` or `""`)
    - `pathname`: Path string (e.g., `"/path"`)
    - `search`: Query string (e.g., `"?key=value"`)
    - `hash`: Fragment identifier (e.g., `"#section"`)
    - `origin`: Full origin (e.g., `"https://example.com:8080"`)
    - `username`: Authentication username or `""`
    - `isHttps`: Boolean flag indicating whether HTTPS is used

---

## Technology Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) (V8 runtime with `nodejs_compat`)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **MCP Server SDK**: [@modelcontextprotocol/server](https://www.npmjs.com/package/@modelcontextprotocol/server)
- **MCP HTTP Handler**: [agents/mcp/server](https://www.npmjs.com/package/agents)
- **MCP Client SDK**: [@modelcontextprotocol/client](https://www.npmjs.com/package/@modelcontextprotocol/client)
- **Schema Validation**: [Zod](https://zod.dev/)
- **Test Runner**: Node.js Test Runner (`node:test`)
- **Linter & Formatter**: [oxlint](https://oxc.rs/) and [oxfmt](https://oxc.rs/)
- **Deployment**: [Wrangler](https://developers.cloudflare.com/workers/wrangler/)

---

## Project Architecture

```text
universal-mcp-toolkit/
├── src/
│   ├── index.ts                     # Cloudflare Worker entry point and fetch handler
│   ├── server.ts                    # McpServer factory and tool registration
│   ├── tools/
│   │   ├── index.ts                 # Tool exports and registerAllTools() registry
│   │   ├── types.ts                 # MCP ToolResult type interfaces
│   │   └── developer/
│   │       ├── base64-decode.ts     # base64_decode implementation
│   │       ├── base64-encode.ts     # base64_encode implementation
│   │       ├── hash-text.ts         # hash_text implementation
│   │       ├── json-format.ts       # json_format implementation
│   │       └── url-parse.ts         # url_parse implementation
│   └── utils/
│       └── validation.ts            # Common result builders and Base64 format validator
├── tests/
│   ├── mcp-protocol.test.ts         # End-to-end MCP client handshake and tool invocation tests
│   ├── server.test.ts               # Server instantiation and calculator deprecation tests
│   └── tools/
│       ├── base64.test.ts           # Unit tests for base64 encoding and decoding
│       ├── hash-text.test.ts        # Unit tests for cryptographic hashing
│       ├── json-format.test.ts      # Unit tests for JSON formatting
│       └── url-parse.test.ts        # Unit tests for URL inspection
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```

---

## Local Development & Testing

### Prerequisites

- Node.js `24.x` or compatible
- npm `11.x` or compatible

### Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/universal-mcp-toolkit.git
cd universal-mcp-toolkit

# Install dependencies
npm install
```

### Running Tests and Quality Checks

```bash
# Run unit and end-to-end MCP tests
npm test

# Run TypeScript compilation check
npm run type-check

# Run linter
npm run lint

# Check code formatting
npm run format

# Run security vulnerability audit
npm audit
```

### Running the Local Server

```bash
npm run dev
# or
npm start
```

By default, the local Worker will be available at:
`http://localhost:8787/mcp` (or `http://127.0.0.1:8787/mcp`)

---

## Independent Deployment Guide

Each developer deploys their own independent instance into their own Cloudflare account.

### Step 1: Create a Cloudflare Account

Sign up at [cloudflare.com](https://dash.cloudflare.com/sign-up) if you do not already have an account. The free plan is fully sufficient.

### Step 2: Authenticate Wrangler

Log in to your Cloudflare account from the command line:

```bash
npx wrangler login
```

This opens a browser window to authorize Wrangler on your personal account.

### Step 3: Verify the Build

Test the build without deploying:

```bash
npx wrangler deploy --dry-run
```

### Step 4: Deploy Your Worker

Deploy the Worker directly to your personal Cloudflare account:

```bash
npm run deploy
```

Upon completion, Wrangler will output your dedicated production URL:

```text
Uploaded universal-mcp-toolkit (x.xx sec)
Deployed universal-mcp-toolkit triggers
  https://universal-mcp-toolkit.<your-subdomain>.workers.dev
```

Your MCP endpoint is:
`https://universal-mcp-toolkit.<your-subdomain>.workers.dev/mcp`

---

## Connecting to MCP Clients

`universal-mcp-toolkit` implements the official MCP specification using Streamable HTTP. Because remote Streamable HTTP support and connection mechanisms vary across different MCP client applications, consult your client's documentation for connecting to remote HTTP endpoints.

### Example: Claude Desktop Configuration

One supported configuration for desktop applications like Claude Desktop is using the official Anthropic [mcp-remote](https://www.npmjs.com/package/mcp-remote) proxy bridge.

Add this entry to your Claude Desktop configuration file (`claude_desktop_config.json`):

```json
{
	"mcpServers": {
		"universal-toolkit": {
			"command": "npx",
			"args": [
				"-y",
				"mcp-remote",
				"https://universal-mcp-toolkit.<your-subdomain>.workers.dev/mcp"
			]
		}
	}
}
```

For local testing with Claude Desktop while running `npm run dev`:

```json
{
	"mcpServers": {
		"universal-toolkit-local": {
			"command": "npx",
			"args": ["-y", "mcp-remote", "http://localhost:8787/mcp"]
		}
	}
}
```

### Example: Programmatic TypeScript Client

You can also connect directly from TypeScript using `@modelcontextprotocol/client`:

```typescript
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const transport = new StreamableHTTPClientTransport(
	new URL("https://universal-mcp-toolkit.<your-subdomain>.workers.dev/mcp"),
);

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log(
	"Available tools:",
	tools.tools.map((t) => t.name),
);
```

---

## Security Model & Considerations

1. **Public Endpoint & Absence of Authentication**:
    - The `/mcp` route is deployed publicly accessible and currently does not implement authentication.
    - Anyone who sends an HTTP POST request to your worker URL can invoke the MCP tools.
2. **Host and Origin Validation Are Not Authentication**:
    - Host header validation ensures requests are addressed to your domain or localhost.
    - Origin header validation checks the source of requests initiated by web browsers. Non-browser MCP clients (such as CLI tools, desktop proxies, and curl) do not send an Origin header, so Origin validation is not an authentication barrier.
3. **URL Secrecy Is Not a Security Boundary**:
    - Keeping your Worker endpoint URL confidential provides obscurity, not true security. If your URL is shared, exposed in logs, or discovered, external callers can execute requests.
4. **Realistic Operational Risk**:
    - Because the five current tools are pure, stateless functions, callers cannot compromise private databases, access server filesystems, execute shell commands, or perform SSRF network requests.
    - The primary realistic risk is **quota consumption**: third parties calling your endpoint can consume your daily Cloudflare request allowance.
5. **Future Authentication Roadmap**:
    - For future tool additions that interact with sensitive resources, third-party APIs, or private state, authentication (such as a Pre-Shared Secret verified via `Authorization: Bearer <token>`) can be added.

---

## Cloudflare Free-Tier Limits

This project is designed to run within the **Cloudflare Workers Free Tier**. Please note that limits apply account-wide across all Workers in your Cloudflare account and are subject to change per Cloudflare's published terms:

- **Daily Request Limit**: 100,000 requests per day across your Cloudflare account (resets daily at 00:00 UTC).
- **CPU Execution Time**: Up to 10 ms CPU time per request. This measures active CPU processing time, not wall-clock I/O wait time.
- **HTTP Request Body Size**:
    - Cloudflare Workers platform limit: Up to 100 MB request bodies accepted at the edge.
    - MCP SDK limit: The installed `@modelcontextprotocol/server` enforces a default maximum request body size of 4 MB (`DEFAULT_MAX_REQUEST_BODY_SIZE`) on inbound JSON-RPC messages.
- **Memory**: 128 MB per execution context.

No credit card or paid subscription is required to deploy this toolkit. If your account reaches the daily request quota, Cloudflare will return HTTP 429/1010 until the quota resets at UTC midnight; you will not be billed automatically.

---

## License

This project is licensed under the [MIT License](LICENSE).
