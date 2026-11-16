# universal-mcp-toolkit

A modular, cloud-deployable universal Model Context Protocol (MCP) server toolkit built for Cloudflare Workers.

`universal-mcp-toolkit` provides a stateless developer utility and agent discovery toolkit adhering to the official Model Context Protocol standard. It is designed to be client-agnostic, secure, free-tier friendly, and deployable within Cloudflare Workers allowances.

> **Important**: Every developer deploys their own independent instance into their own Cloudflare account and receives their own endpoint. There is no shared, centralized, or managed endpoint operated by the repository owner.

---

## Key Features

- **MCP-Standard**: Built using the official MCP TypeScript SDK and Streamable HTTP transport, designed for compatibility with MCP-compliant clients.
- **GitHub Agent Discovery Foundation (v0.4.0)**: Discover and inspect public AI agent projects, agent frameworks (LangGraph, CrewAI, AutoGen, OpenAI Swarm, Semantic Kernel, Smolagents, etc.), multi-agent systems, and MCP/A2A implementations on GitHub using evidence-based detection, confidence scoring, and safe bounded README inspection.
- **A2A Agent Discovery Foundation (v0.3.0)**: Discover and inspect public A2A (Agent-to-Agent) agents by retrieving and validating their standard `/.well-known/agent-card.json` endpoints according to the official A2A specification with v0.3 backward compatibility.
- **Strict SSRF Hardening**: Enterprise-grade Server-Side Request Forgery protections for external agent card retrieval: HTTPS enforcement, non-standard port blocking (only 443/8443 permitted), private/loopback/link-local/cloud-metadata IP blocking, same-origin redirect verification (manual redirects with max 3 hops), Content-Type verification, 1MB bounded response reader, and 8s timeout aborts.
- **MCP Registry Discovery Foundation (v0.2.0)**: Discover and inspect published MCP servers from the official registry (`registry.modelcontextprotocol.io`), normalized into the standardized Universal Agent Profile schema.
- **Universal Agent Profile**: Standardized, extensible agent descriptor modeling identity, communication endpoints, capabilities, skills, authentication requirements, and trust levels across MCP, A2A, and GitHub ecosystems.
- **Pluggable Discovery Architecture**: Modular connector interface (`DiscoveryConnector`) and safe engine (`DiscoveryEngine`) coordinating multi-source aggregation (Official MCP Registry, A2A Protocol, GitHub, and future sources).
- **Stateless & Resilient**: Pure stateless operation with timeout safeguards, error normalization, deduplication, and zero persistent database overhead.
- **Independent Serverless Deployment**: Hosted on Cloudflare Workers for edge execution without managing physical or virtual servers.
- **Free-Tier Friendly**: Uses standard Web APIs (Web Crypto, URL, TextEncoder/TextDecoder). Zero paid dependencies, subscriptions, or external paid APIs.
- **Strict Validation**: All tool parameters and data profiles are validated at runtime via Zod schemas.
- **Structured Error Handling**: Catches malformed input and network exceptions, returning structured MCP error responses (`isError: true`) without causing server crashes.

---

## Available Tools

The toolkit exposes eleven tools across developer utilities and agent discovery:

### Developer Utilities

#### 1. `json_format`

Format and validate JSON input with customizable indentation.

- **Inputs**:
    - `json` (_string_, required): Raw JSON string to format and validate.
    - `indent` (_integer_, optional, default `2`, range `0`–`8`): Number of spaces for indentation. `0` produces compact minified JSON.
- **Output**: Formatted JSON string or descriptive syntax error.

#### 2. `base64_encode`

Encode text into Base64 format with full Unicode and emoji support.

- **Inputs**:
    - `text` (_string_, required): UTF-8 text to encode.
- **Output**: Base64-encoded string.

#### 3. `base64_decode`

Decode Base64 strings into UTF-8 text with strict validation.

- **Inputs**:
    - `encoded` (_string_, required): Base64-encoded string.
- **Output**: Decoded UTF-8 string, or a structured error if the input contains invalid characters, incorrect padding, or invalid UTF-8 byte sequences.

#### 4. `hash_text`

Generate a cryptographic hash using standard Web Crypto (`crypto.subtle.digest`).

- **Inputs**:
    - `text` (_string_, required): Text to hash.
    - `algorithm` (_enum_, optional, default `"SHA-256"`): Allowed options: `"SHA-256"`, `"SHA-384"`, `"SHA-512"`. Deprecated or weak algorithms (MD5, SHA-1) are rejected.
- **Output**: Lowercase hexadecimal hash string.

#### 5. `url_parse`

Parse and inspect a URL without making outbound network requests.

- **Inputs**:
    - `url` (_string_, required): Absolute URL string to inspect.
- **Output**: Structured JSON containing protocol, hostname, port, pathname, search, hash, origin, username, and isHttps flag.

---

### Agent Discovery Foundation Tools

#### 6. `search_mcp_registry`

Search published servers on the official Model Context Protocol Registry (`https://registry.modelcontextprotocol.io`). Returns normalized Universal Agent Profiles and pagination metadata.

- **Inputs**:
    - `query` (_string_, required, 3–200 chars): Search keyword or substring (minimum 3 characters after trimming).
    - `limit` (_integer_, optional, default `20`, range `1`–`100`): Maximum profiles to return.
    - `cursor` (_string_, optional): Opaque pagination cursor from a previous response.
    - `latest_only` (_boolean_, optional, default `true`): Whether to return only the latest version of each server. Set `false` to include historical versions.
- **Output**: JSON payload with `query`, `latestOnly`, `count`, `nextCursor`, `source`, and `profiles` array.

#### 7. `get_mcp_server_details`

Retrieve detailed metadata and server manifests for a specific server from the official MCP Registry, mapped into a Universal Agent Profile. Allows inspecting any individual historical version or latest release.

- **Inputs**:
    - `server_name` (_string_, required): Reverse-DNS or unique server identifier (e.g. `ac.inference.sh/mcp` or `io.github.test/server`).
    - `version` (_string_, optional, default `"latest"`): Target semantic version string (e.g. `"1.0.0"`) or `"latest"`.
- **Output**: Complete normalized `AgentProfile` JSON object.

#### 8. `validate_agent_profile`

Statelessly validate and normalize a candidate agent profile against the Universal Agent Profile schema. Detects schema violations, highlights missing optional fields, reports unknown properties, and applies safe defaults.

- **Inputs**:
    - `profile` (_object | string_, required): Candidate agent profile object or JSON string (max 512KB, max 100 top-level keys, max nesting depth 6).
    - `normalize` (_boolean_, optional, default `true`): Whether to auto-fill safe defaults and sanitize structure.
- **Output**: Validation report containing `valid` (boolean), `normalizedProfile`, `missingOptionalFields`, `validationErrors`, and `unknownProperties`.

#### 9. `discover_a2a_agent`

Discover an A2A (Agent-to-Agent) agent by retrieving and validating its public Agent Card from its standard `/.well-known/agent-card.json` endpoint. Applies strict SSRF controls, parses according to official A2A v1.0 specifications (with legacy v0.3 compatibility), and returns a normalized Universal Agent Profile along with rich interface and skill manifests.

- **Inputs**:
    - `agent_url` (_string_, required, 1–2048 chars): Public HTTPS base URL (e.g. `https://agent.example.com`) or direct Agent Card URL (e.g. `https://agent.example.com/.well-known/agent-card.json`).
- **Output**: JSON response containing `status: "discovered"`, `agentUrl`, `agentCardUrl`, `agent` summary, `interfaces` array, `skills` array, `capabilities`, `inputModes`, `outputModes`, `authentication`, `trust`, and complete normalized `profile`.

#### 10. `search_github_agents`

Discover AI agent repositories, agent frameworks, multi-agent systems, and MCP/A2A projects on GitHub using public repository search. Performs evidence-based agent detection, computes confidence scores, and returns normalized Universal Agent Profiles.

- **Inputs**:
    - `query` (_string_, required, 1–200 chars): Search keywords or GitHub qualifiers (e.g. `'agent framework'`, `'langgraph in:description'`, `'topic:autonomous-agents'`).
    - `page` (_integer_, optional, default `1`): Page number for pagination.
    - `per_page` (_integer_, optional, default `10`, range `1`–`50`): Number of repository results per page.
    - `sort` (_string_, optional, enum: `["stars", "forks", "updated", "help-wanted-issues"]`): Sort field for repository results.
    - `order` (_string_, optional, default `"desc"`, enum: `["asc", "desc"]`): Sort direction.
- **Output**: JSON response containing `status: "discovered"`, `query`, `count`, `totalCount`, `page`, `perPage`, `rateLimit`, `repositories` array (summaries with classification, confidence score, detected frameworks, and evidence), and normalized `profiles` array.

#### 11. `get_github_agent_details`

Retrieve detailed metadata, agent classification, confidence score, evidence, and normalized Universal Agent Profile for a specific public GitHub repository. Optionally retrieves and safely inspects the repository README for deeper evidence without executing content or following external links.

- **Inputs**:
    - `owner` (_string_, required, 1–39 chars): GitHub username or organization name (e.g. `'langchain-ai'`).
    - `repo` (_string_, required, 1–100 chars): GitHub repository name (e.g. `'langgraph'`).
    - `include_readme` (_boolean_, optional, default `false`): Whether to retrieve and safely inspect the repository README.
- **Output**: JSON response containing `status: "success"`, complete `repository` metadata, `detection` breakdown (classification, confidence score, frameworks, capabilities, inferred skills, evidence list), optional `readme` excerpt, `rateLimit` info, and normalized `profile`.

---

## Universal Agent Profile

The Universal Agent Profile is a canonical, ecosystem-neutral descriptor for AI agents and MCP servers.

```typescript
export interface AgentProfile {
	id: string; // Canonical unique identifier: `${source.type}:${host}/${identifier}@${version}`
	name: string; // Display name
	description: string; // Functional description
	source: {
		type: "mcp-registry" | "a2a" | "github" | "custom" | "manual";
		name: string; // Source catalog or origin name
		url?: string; // Repository or listing URL
		identifier: string; // Original package or server identifier
	};
	classification: {
		capabilities: string[]; // Functional capabilities (e.g. "mcp:server", "a2a:agent", "streaming")
		skills: string[]; // Discrete declared or verified skills
		categories: string[]; // Taxonomy classifications (e.g. "agent", "a2a", "mcp-server")
		tags: string[]; // Searchable tags and metadata keywords
	};
	communication: {
		protocols: string[]; // Supported protocols (e.g. "mcp", "json-rpc", "streamable-http", "a2a")
		framework?: string; // Underlying framework (e.g. "modelcontextprotocol", "a2a")
		endpoint?: string; // Publicly reachable endpoint URL if declared
	};
	authentication: {
		required: boolean; // Whether authentication is required
		declaredMethods: string[]; // Declared auth types (e.g. "none", "bearer", "oauth2", "apiKey")
	};
	io: {
		supportedInputs: string[]; // Accepted input formats (e.g. ["application/json", "text/plain"])
		supportedOutputs: string[]; // Generated output formats (e.g. ["application/json"])
	};
	metadata: {
		version?: string; // Semantic version string (optional; absent if undeclared)
		provider?: string; // Author, organization, or publisher
		lastUpdated?: string; // ISO timestamp of last modification
		discoveryTimestamp: string; // ISO timestamp of ingestion
		documentationUrl?: string; // Link to documentation
		iconUrl?: string; // Avatar or icon image link
		a2a?: Record<string, unknown>; // Protocol-specific A2A metadata
		github?: Record<string, unknown>; // GitHub repository & agent detection metadata
		extra?: Record<string, unknown>; // Preserved custom extension properties
	};
	trust: {
		status: "declared" | "verified" | "observed";
		notes?: string; // Evaluation context (e.g. unverified declared metadata)
	};
}
```

### Trust Status Model

- **`declared`**: The default status for all profiles imported from public registries, catalogs, A2A Agent Cards, GitHub repositories, or manual inputs. All metadata is self-reported by the publisher or inferred from repository metadata and has not undergone independent cryptographic or out-of-band verification. Popularity metrics (e.g. GitHub star counts) never elevate trust to `verified`.
- **`verified`**: Reserved for identities or capabilities verified through cryptographic signatures, authenticated DNS records, or trusted attestation pipelines.
- **`observed`**: Reserved for runtime attributes verified through active empirical testing (e.g., successful protocol handshakes, latency measurements).

---

## Discovery Connector Architecture

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                      DiscoveryEngine                                      │
│                  (pluggable connector registry & deduplication pipeline)                  │
└───────────────┬─────────────────────────────┬─────────────────────────────┬───────────────┘
                │                             │                             │
                ▼                             ▼                             ▼
┌──────────────────────────────┐┌─────────────────────────────┐┌─────────────────────────────┐
│     McpRegistryConnector     ││    A2AAgentCardConnector    ││       GitHubConnector       │
│ (official MCP registry API)  ││ (strict SSRF A2A discovery) ││(evidence-based agent detect)│
└───────────────┬──────────────┘└─────────────┬───────────────┘└─────────────┬───────────────┘
                │                             │                              │
                ▼                             ▼                              ▼
┌──────────────────────────────┐┌─────────────────────────────┐┌─────────────────────────────┐
│   Registry Server Normalizer ││   A2A Agent Card Normalizer ││   GitHub Repo Normalizer    │
│   - maps MCP manifest        ││   - maps v1.0 Agent Card    ││   - agent classification    │
│   - marks trust: declared    ││   - preserves provider/auth ││   - confidence scoring      │
└───────────────┬──────────────┘└─────────────┬───────────────┘└─────────────┬───────────────┘
                │                             │                              │
                └─────────────────────────────┼──────────────────────────────┘
                                              ▼
                               ┌───────────────────────────────┐
                               │     Universal AgentProfile    │
                               │     (Zod schema validation)   │
                               └───────────────────────────────┘
```

1. **Connector Interface (`DiscoveryConnector`)**: Pluggable interface defining `search()` and `getDetails()` contracts.
2. **MCP Registry Client (`McpRegistryClient`)**: Communicates exclusively with the official registry (`https://registry.modelcontextprotocol.io`) with strict origin validation, configurable timeouts (8s default) with `AbortSignal`, and HTTP status mapping (404, 429, 5xx).
3. **A2A Agent Card Client (`A2AAgentCardClient`)**: Connects to public A2A agent endpoints to fetch `/.well-known/agent-card.json`. Enforces strict SSRF protections:
    - Only HTTPS URLs permitted.
    - Non-standard ports blocked (only 443 and 8443 allowed).
    - Private, loopback, multicast, link-local, carrier-grade NAT, and cloud metadata IPs blocked (IPv4 and IPv6).
    - Internal and loopback hostnames blocked (`localhost`, `*.local`, `*.internal`, `*.corp`, `*.lan`, `metadata.google.internal`, single-label hostnames).
    - Redirects handled manually (`redirect: "manual"`): verifies same-origin on every hop; blocks cross-origin and protocol-downgrade redirects; maximum 3 redirect hops.
    - Response body bounded to 1 MB maximum.
    - 8-second request timeout via `AbortController`.
    - Requires valid `application/json` Content-Type.
4. **GitHub Discovery Client (`GitHubClient`) & Agent Detector**: Communicates with the official GitHub REST API (`https://api.github.com`):
    - Origin validation pinning requests strictly to `https://api.github.com`.
    - Safe identifier validation preventing path traversal or dot navigation on owners and repositories.
    - Manual redirect verification strictly enforcing HTTPS and API origin persistence.
    - Bounded response body reading (1 MB limit) and request timeouts (8s default).
    - Safe Base64 README decoding with text window truncation (32 KB limit) to prevent unbounded memory usage.
    - Evidence-based agent detection: analyzes repository name, description, topics, README content, and framework references without requiring a hardcoded allowlist.
    - Deterministic classification precedence: classifies repositories into `framework_library`, `confirmed_agent`, `likely_agent`, `general_ai`, and `insufficient_evidence` with confidence scores strictly bounded between 0.0 and 1.0. Framework/library projects are never classified as operational agents.
    - Strict README inference markers: capabilities detected via README inspection are explicitly recorded as `inferred:readme:capability:<name>` in evidence, and generic prose mentioning code execution never triggers `code-execution` capability without explicit sandbox markers.
    - Transparent public rate-limit handling parsing `x-ratelimit-remaining` and returning human-readable reset timestamps on HTTP 403 / 429.
5. **Normalization Services**: Converts upstream MCP Registry manifests, A2A Agent Cards, and GitHub repository records into standard `AgentProfile` models without fabricating unsupported capabilities or credentials:
    - **Semantically Accurate GitHub Mapping**: GitHub is a discovery source and code repository, not an operational agent protocol (`communication.protocols: []`).
    - **No Fake Endpoints**: Repository HTML URLs are code/docs references, not operational endpoints (`communication.endpoint: undefined`).
    - **Undeclared Auth**: Runtime authentication models of codebases are undeclared (`authentication.declaredMethods: []`).
    - **Version Semantics**: VCS branch pointers are not versions (`metadata.version` is absent/omitted when undeclared; default branch is preserved in `metadata.github.defaultBranch`).
    - **License Verification**: Only repositories with recognized OSI/SPDX open-source licenses receive the `"open-source"` category tag.
6. **Deduplication Engine**: Keyed on `${sourceType}:::${identifier}:::${version}` to filter duplicates while preserving distinct version manifests and providers.

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
│   ├── index.ts                           # Cloudflare Worker entry point and fetch handler
│   ├── server.ts                          # McpServer factory and tool registration
│   ├── discovery/                         # Agent discovery subsystem
│   │   ├── connectors/
│   │   │   ├── a2a/                       # A2A Agent Card connector & client
│   │   │   │   ├── agent-card-schema.ts   # A2A Agent Card Zod validation schema
│   │   │   │   ├── client.ts              # A2AAgentCardClient with strict SSRF defense
│   │   │   │   ├── connector.ts           # A2AAgentCardConnector implementing DiscoveryConnector
│   │   │   │   └── types.ts               # A2A TypeScript interfaces and types
│   │   │   ├── github/                    # GitHub repository connector & client (v0.4.0)
│   │   │   │   ├── connector.ts           # GitHubConnector implementing DiscoveryConnector
│   │   │   │   ├── github-agent-detector.ts # Evidence-based agent detector & classifier
│   │   │   │   ├── github-client.ts       # GitHubClient with origin validation & rate-limit handling
│   │   │   │   ├── github-repository-schema.ts # GitHub API Zod validation schemas
│   │   │   │   └── types.ts               # GitHub TypeScript interfaces and types
│   │   │   └── mcp-registry/              # Official MCP Registry connector & client
│   │   ├── deduplication/                 # Profile deduplication utility
│   │   ├── normalizer/                    # Profile normalization & validation service
│   │   │   ├── a2a-agent-card-normalizer.ts # A2A Agent Card -> AgentProfile normalizer
│   │   │   ├── github-repo-normalizer.ts  # GitHub Repository -> AgentProfile normalizer
│   │   │   └── mcp-registry-normalizer.ts # MCP Registry Server -> AgentProfile normalizer
│   │   ├── search/                        # DiscoveryEngine multi-connector coordinator
│   │   ├── types/                         # AgentProfile & DiscoveryConnector schemas
│   │   └── index.ts                       # Barrel export for discovery subsystem
│   ├── tools/
│   │   ├── developer/                     # Developer utility tools (json, base64, hash, url)
│   │   ├── discovery/                     # Discovery tools (search, details, validate, a2a, github)
│   │   ├── index.ts                       # Central tool registration (registerAllTools)
│   │   └── types.ts                       # Tool result interfaces
│   └── utils/
│       └── validation.ts                  # Common validation and response utilities
├── tests/
│   ├── discovery/                         # Unit tests for discovery subsystem (A2A, MCP Registry, GitHub)
│   ├── mcp-protocol.test.ts               # Protocol-level E2E tests for all 11 tools
│   ├── server.test.ts                     # McpServer registration verification tests
│   └── tools/                             # Unit tests for developer & discovery tools
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
# Clone your repository
git clone https://github.com/<your-username>/universal-mcp-toolkit.git
cd universal-mcp-toolkit

# Install dependencies
npm install
```

### Running Tests and Quality Checks

```bash
# Run unit and end-to-end MCP tests (146 tests)
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
4. **SSRF Defense Architecture & Runtime Boundaries (A2A Discovery)**:
    - The `discover_a2a_agent` tool makes outbound HTTPS requests to retrieve public Agent Cards. It enforces multi-layered SSRF defenses:
        - **HTTPS Required**: Rejects plaintext `http://`, `ftp://`, `file://`, and JavaScript URIs.
        - **Port Allowlist**: Restricts ports strictly to 443 and 8443; blocks SSH, SMTP, internal HTTP, and backend service ports.
        - **IP Range Denylist**: Blocks literal loopback (`127.0.0.0/8`, `::1`), private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`), link-local and cloud metadata endpoints (`169.254.0.0/16`, `fe80::/10`), CGNAT (`100.64.0.0/10`), multicast (`224.0.0.0/4`, `ff00::/8`), benchmark networks, and IPv6 special ranges (IPv4-mapped IPv6 `::ffff:`, NAT64 `64:ff9b::/96`, documentation `2001:db8::/32`, ORCHID `2001:10::/28`, `2001:20::/28`, discard `100::/64`, and 6to4 `2002::/16`).
        - **Hostname Denylist**: Blocks `localhost`, `*.local`, `*.internal`, `*.corp`, `*.lan`, `metadata.google.internal`, and single-label hostnames without a public domain suffix.
        - **Manual Redirect Verification**: Re-validates port, credentials, and hostname at every redirect hop; blocks cross-origin redirects, protocol downgrades, and redirect loops (max 3 hops).
        - **Bounded Consumption**: Max 1 MB payload limits and 8s timeout aborts prevent resource exhaustion.
        - **Cloudflare Workers Runtime Boundary & DNS Rebinding**: Because Cloudflare Workers isolates run on standard Web APIs (`fetch`) without low-level socket inspection or custom pre-connect DNS resolver hooks (`dns.lookup`), string-level URL validation catches literal IP addresses and reserved internal domains but cannot inspect the resolved IP address of arbitrary external domain names before connection. Thus, DNS rebinding (a public domain whose DNS record points to a private/internal IP) is not prevented at the application layer. For enterprise environments with access to sensitive internal networks, outbound worker requests should be governed via Cloudflare Zero Trust / Gateway egress policies or an egress forward proxy.
5. **GitHub API Security & Rate Limit Controls**:
    - **Pinned Origin**: Requests are strictly constrained to the official GitHub API origin (`https://api.github.com`). Cross-origin requests or protocol downgrades are rejected.
    - **Identifier Sanitization**: Repository owner and name are strictly validated against `/^[a-zA-Z0-9_.-]+$/`; path traversal, dot navigation (`.`, `..`), and path separators (`/`, `\`) are blocked.
    - **No Code Execution or Link Traversal**: Discovery is strictly metadata-based. The toolkit **never clones, downloads, executes, or installs repository code**, never interprets README content as system or agent instructions, and never follows external URLs discovered in README documents.
    - **Bounded Consumption**: Response bodies are capped at 1 MB; README Base64 decoding is bounded to 32 KB text window to prevent memory exhaustion in Cloudflare Workers.
    - **GitHub Rate Limits (Search vs Core API)**: Official GitHub unauthenticated REST API policies impose two distinct rate limit tiers:
        - **Search API (`search_github_agents`)**: 10 requests per minute per IP address.
        - **Core API (`get_github_agent_details` / repository metadata / README)**: 60 requests per hour per IP address.
    - **Cloudflare Worker Shared Egress IP Implication**: In serverless edge environments like Cloudflare Workers, outbound HTTP requests exit through shared public Cloudflare edge IP addresses. Because GitHub tracks unauthenticated rate limits strictly by caller IP address, unauthenticated requests from your Worker share rate limit allocations with other workloads originating from that same egress IP pool. As a result, rate limits may be reached faster during periods of heavy multi-tenant edge activity. The toolkit parses `x-ratelimit-remaining` and `x-ratelimit-reset` headers; when limits are exceeded (HTTP 403 or 429), it returns a clean structured error with the UTC reset timestamp rather than throwing unhandled exceptions.
    - **Strict Semantic Accuracy in Profile Normalization**: In alignment with zero-trust discovery:
        - GitHub is treated as a discovery source and code host, not an agent communication protocol (`protocols: []`).
        - HTML repository URLs are treated as documentation/source references, not operational agent endpoints (`endpoint: undefined`).
        - Repository code has undeclared runtime authentication (`declaredMethods: []`).
        - Default branches (`main`, `master`) are VCS pointers, not software versions (`version` is omitted/absent when undeclared; default branch is preserved in `metadata.github.defaultBranch`).
        - Repositories are only assigned the `"open-source"` category if their SPDX license explicitly matches a recognized open-source license.
6. **Agent Card & Repository Trust Policy**:
    - Optional cryptographic signatures (`signatures` array in A2A v1.0) are preserved in normalized profile metadata under `metadata.a2a.signatures`.
    - Signatures are explicitly marked as unverified (`verified: false`, `status: "unverified"`).
    - In adherence to zero-trust principles, profile trust status strictly remains `"declared"`. The presence of a signature declaration or high GitHub star counts never elevates trust to `"verified"` without cryptographic key retrieval and signature verification.
7. **Realistic Operational Risk**:
    - Because the eleven current tools are pure, stateless functions, callers cannot compromise private databases, access server filesystems, or execute arbitrary shell commands.
    - Outbound requests from discovery tools are constrained to the pinned official MCP Registry, pinned official GitHub API, or hardened public HTTPS A2A endpoints.
    - The primary realistic risk is **quota consumption**: third parties calling your endpoint can consume your daily Cloudflare request allowance.
8. **Future Authentication Roadmap**:
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
