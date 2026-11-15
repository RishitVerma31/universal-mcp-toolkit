import test from "node:test";
import assert from "node:assert/strict";
import {
	McpRegistryClient,
	OFFICIAL_MCP_REGISTRY_BASE_URL,
} from "../../src/discovery/connectors/mcp-registry/client.ts";
import { McpRegistryConnector } from "../../src/discovery/connectors/mcp-registry/connector.ts";
import type {
	McpRegistryListResponse,
	McpRegistryDetailResponse,
} from "../../src/discovery/connectors/mcp-registry/types.ts";

function createMockFetch(
	handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof fetch {
	return handler as typeof fetch;
}

test("mcp-registry: search returns normalized profiles and pagination", async () => {
	const mockData: McpRegistryListResponse = {
		servers: [
			{
				server: {
					name: "io.example/calculator",
					title: "Example Calculator",
					description: "Perform math operations",
					version: "1.2.0",
					remotes: [{ type: "streamable-http", url: "https://example.com/mcp" }],
					repository: { url: "https://github.com/example/calculator", source: "github" },
				},
				_meta: {
					"io.modelcontextprotocol.registry/official": {
						status: "active",
						publishedAt: "2026-03-01T00:00:00Z",
						updatedAt: "2026-03-02T00:00:00Z",
						isLatest: true,
					},
				},
			},
		],
		metadata: {
			count: 1,
			nextCursor: "cursor_abc123",
		},
	};

	let requestedUrl = "";
	const mockFetch = createMockFetch(async (url) => {
		requestedUrl = url;
		return new Response(JSON.stringify(mockData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	const result = await connector.search({ query: "calculator", limit: 10 });

	assert.ok(requestedUrl.includes("/v0.1/servers?search=calculator&limit=10"));
	assert.equal(result.profiles.length, 1);
	assert.equal(result.nextCursor, "cursor_abc123");
	assert.equal(result.profiles[0].id, "mcp-registry:io.example/calculator@1.2.0");
	assert.equal(result.profiles[0].trust.status, "declared");
});

test("mcp-registry: handles empty search results cleanly", async () => {
	const mockData: McpRegistryListResponse = {
		servers: [],
		metadata: { count: 0 },
	};

	const mockFetch = createMockFetch(async () => {
		return new Response(JSON.stringify(mockData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	const result = await connector.search({ query: "nonexistent" });

	assert.equal(result.profiles.length, 0);
	assert.equal(result.totalCount, 0);
	assert.equal(result.nextCursor, null);
});

test("mcp-registry: getDetails retrieves server by name and version", async () => {
	const mockDetail: McpRegistryDetailResponse = {
		server: {
			name: "io.example/weather",
			title: "Weather Service",
			description: "Global weather forecasts",
			version: "2.0.0",
			remotes: [{ type: "sse", url: "https://weather.example.com/sse" }],
		},
		_meta: {
			"io.modelcontextprotocol.registry/official": {
				status: "active",
				isLatest: true,
			},
		},
	};

	let requestedUrl = "";
	const mockFetch = createMockFetch(async (url) => {
		requestedUrl = url;
		return new Response(JSON.stringify(mockDetail), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	const profile = await connector.getDetails("io.example/weather", { version: "2.0.0" });

	assert.ok(requestedUrl.includes("io.example%2Fweather/versions/2.0.0"));
	assert.ok(profile);
	assert.equal(profile?.name, "Weather Service");
	assert.equal(profile?.metadata.version, "2.0.0");
	assert.equal(profile?.trust.status, "declared");
});

test("mcp-registry: getDetails returns null for 404 not found", async () => {
	const mockFetch = createMockFetch(async () => {
		return new Response(JSON.stringify({ title: "Not Found", status: 404 }), {
			status: 404,
			headers: { "Content-Type": "application/problem+json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	const profile = await connector.getDetails("io.example/missing");
	assert.equal(profile, null);
});

test("mcp-registry: throws clear error on 429 rate limit", async () => {
	const mockFetch = createMockFetch(async () => {
		return new Response(JSON.stringify({ title: "Too Many Requests", status: 429 }), {
			status: 429,
			headers: { "Content-Type": "application/problem+json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	await assert.rejects(
		() => connector.search({ query: "test" }),
		/Rate limit exceeded by MCP Registry \(HTTP 429\)/,
	);
});

test("mcp-registry: throws on HTTP 500 server error", async () => {
	const mockFetch = createMockFetch(async () => {
		return new Response("Internal Server Error", {
			status: 500,
			statusText: "Internal Server Error",
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	await assert.rejects(
		() => connector.search({ query: "test" }),
		/MCP Registry request failed with status 500/,
	);
});

test("mcp-registry: throws on malformed JSON response", async () => {
	const mockFetch = createMockFetch(async () => {
		return new Response("<html>Not JSON</html>", {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	await assert.rejects(
		() => connector.search({ query: "test" }),
		/Invalid JSON response received from MCP Registry/,
	);
});

test("mcp-registry: throws on network failure", async () => {
	const mockFetch = createMockFetch(async () => {
		throw new Error("DNS resolution failed");
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	await assert.rejects(() => connector.search({ query: "test" }), /DNS resolution failed/);
});

test("mcp-registry: aborts request on timeout", async () => {
	const mockFetch = createMockFetch(async (_, init) => {
		return new Promise((_, reject) => {
			init?.signal?.addEventListener("abort", () => {
				const abortErr = new Error("This operation was aborted");
				abortErr.name = "AbortError";
				reject(abortErr);
			});
		});
	});

	const client = new McpRegistryClient({ fetchFn: mockFetch, timeoutMs: 20 });
	await assert.rejects(
		() => client.listServers({ search: "hang" }),
		/MCP Registry request timed out after 20ms/,
	);
});

test("mcp-registry: enforces official base URL origin security", () => {
	const client = new McpRegistryClient();
	assert.ok(client instanceof McpRegistryClient);
	assert.ok(
		OFFICIAL_MCP_REGISTRY_BASE_URL.startsWith("https://registry.modelcontextprotocol.io"),
	);
});

test("mcp-registry: blocks redirect escaping official registry origin", async () => {
	const mockFetch = createMockFetch(async () => {
		return new Response(null, {
			status: 302,
			headers: { Location: "https://evil.com/exfiltrate" },
		});
	});

	const client = new McpRegistryClient({ fetchFn: mockFetch });
	await assert.rejects(
		() => client.listServers({ search: "redirect" }),
		/Security violation: MCP Registry redirect escaped allowed origin/,
	);
});

test("mcp-registry: blocks protocol-relative path traversal", async () => {
	const client = new McpRegistryClient();
	await assert.rejects(
		() => (client as any).request("//evil.com/api"),
		/Security violation: Invalid path containing protocol-relative slash/,
	);
});

test("mcp-registry: connector isolates and skips corrupt entries in search results", async () => {
	const mockData = {
		servers: [
			{
				// Corrupt entry: missing server property
				corrupt: true,
			},
			{
				server: {
					name: "io.example/valid",
					title: "Valid Server",
					version: "1.0.0",
				},
				_meta: {},
			},
		],
		metadata: { count: 2 },
	};

	const mockFetch = createMockFetch(async () => {
		return new Response(JSON.stringify(mockData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	const result = await connector.search({ query: "valid" });
	assert.equal(result.profiles.length, 1);
	assert.equal(result.profiles[0].name, "Valid Server");
});

test("mcp-registry: blocks paths and redirects containing backslashes", async () => {
	const client = new McpRegistryClient();
	await assert.rejects(
		() => (client as any).request("/\\evil.com"),
		/Security violation: Invalid path containing backslash/,
	);

	const mockFetch = createMockFetch(async () => {
		return new Response(null, {
			status: 302,
			headers: { Location: "/\\evil.com/redirect" },
		});
	});
	const redirectClient = new McpRegistryClient({ fetchFn: mockFetch });
	await assert.rejects(
		() => redirectClient.listServers({ search: "test" }),
		/Security violation: Redirect location contains unsafe characters/,
	);
});

test("mcp-registry: search sends version=latest by default and preserves it with pagination", async () => {
	let capturedUrl = "";
	const mockFetch = createMockFetch(async (url) => {
		capturedUrl = url;
		return new Response(JSON.stringify({ servers: [], metadata: { count: 0 } }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	await connector.search({ query: "test", cursor: "next_cursor_123" });
	assert.ok(capturedUrl.includes("version=latest"), "Expected version=latest in search URL");
	assert.ok(capturedUrl.includes("cursor=next_cursor_123"), "Expected cursor in search URL");
	assert.ok(capturedUrl.includes("search=test"), "Expected search in search URL");
});

test("mcp-registry: search omits version=latest when latestOnly is false", async () => {
	let capturedUrl = "";
	const mockFetch = createMockFetch(async (url) => {
		capturedUrl = url;
		return new Response(JSON.stringify({ servers: [], metadata: { count: 0 } }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});

	const connector = new McpRegistryConnector({ fetchFn: mockFetch });
	await connector.search({ query: "test", latestOnly: false });
	assert.equal(
		capturedUrl.includes("version=latest"),
		false,
		"Did not expect version=latest when latestOnly is false",
	);
});

test("mcp-registry: maps HTTP 422 to descriptive validation error", async () => {
	const mockFetch = createMockFetch(async () => {
		return new Response(
			JSON.stringify({
				title: "Unprocessable Entity",
				status: 422,
				detail: "search must contain at least 3 characters after trimming surrounding whitespace",
			}),
			{ status: 422, headers: { "Content-Type": "application/problem+json" } },
		);
	});

	const client = new McpRegistryClient({ fetchFn: mockFetch });
	await assert.rejects(
		() => client.listServers({ search: "ab" }),
		/MCP Registry validation error \(HTTP 422\): search must contain at least 3 characters/,
	);
});
