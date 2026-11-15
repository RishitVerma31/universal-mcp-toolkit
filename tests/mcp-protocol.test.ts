import test from "node:test";
import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import worker from "../src/index.ts";

function createTestTransport() {
	return new StreamableHTTPClientTransport(new URL("http://localhost:8787/mcp"), {
		fetch: async (url, init) => {
			const headers = new Headers(init?.headers);
			if (!headers.has("Host")) {
				headers.set("Host", "localhost:8787");
			}
			const req = new Request(url, { ...init, headers });
			return await worker.fetch(req, {}, {} as ExecutionContext);
		},
	});
}

function getTextContent(res: { content?: Array<{ type: string; text?: string }> }): string {
	assert.ok(res.content && res.content.length > 0, "Response should have content");
	const block = res.content[0];
	assert.equal(block.type, "text", "Content block should be text");
	assert.ok(typeof block.text === "string", "Content text should be a string");
	return block.text;
}

test("mcp protocol e2e: connects, initializes, and lists exactly 8 tools", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	const toolsList = await client.listTools();
	assert.equal(toolsList.tools.length, 8);

	const toolNames = toolsList.tools.map((t) => t.name);
	const expectedTools = [
		"json_format",
		"base64_encode",
		"base64_decode",
		"hash_text",
		"url_parse",
		"search_mcp_registry",
		"get_mcp_server_details",
		"validate_agent_profile",
	];

	for (const expected of expectedTools) {
		assert.ok(toolNames.includes(expected), `Expected tool '${expected}' to be present`);
	}

	assert.equal(toolNames.includes("add"), false, "Calculator 'add' must be absent");
	assert.equal(toolNames.includes("calculate"), false, "Calculator 'calculate' must be absent");

	await client.close();
});

test("mcp protocol e2e: invokes all 5 tools successfully through protocol", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	// 1. json_format
	const resJson = await client.callTool({
		name: "json_format",
		arguments: { json: '{"name":"Jarvis","active":true}' },
	});
	assert.equal(resJson.isError, undefined);
	assert.equal(getTextContent(resJson as any), '{\n  "name": "Jarvis",\n  "active": true\n}');

	// 2. base64_encode
	const resB64Enc = await client.callTool({
		name: "base64_encode",
		arguments: { text: "Hello 🌍" },
	});
	assert.equal(resB64Enc.isError, undefined);
	assert.equal(getTextContent(resB64Enc as any), "SGVsbG8g8J+MjQ==");

	// 3. base64_decode
	const resB64Dec = await client.callTool({
		name: "base64_decode",
		arguments: { encoded: "SGVsbG8g8J+MjQ==" },
	});
	assert.equal(resB64Dec.isError, undefined);
	assert.equal(getTextContent(resB64Dec as any), "Hello 🌍");

	// 4. hash_text
	const resHash = await client.callTool({
		name: "hash_text",
		arguments: { text: "hello world", algorithm: "SHA-256" },
	});
	assert.equal(resHash.isError, undefined);
	assert.equal(
		getTextContent(resHash as any),
		"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
	);

	// 5. url_parse
	const resUrl = await client.callTool({
		name: "url_parse",
		arguments: { url: "https://example.com:8080/path?name=test#section" },
	});
	assert.equal(resUrl.isError, undefined);
	const parsed = JSON.parse(getTextContent(resUrl as any));
	assert.equal(parsed.protocol, "https:");
	assert.equal(parsed.hostname, "example.com");
	assert.equal(parsed.port, "8080");
	assert.equal(parsed.pathname, "/path");
	assert.equal(parsed.search, "?name=test");
	assert.equal(parsed.hash, "#section");
	assert.equal(parsed.isHttps, true);

	await client.close();
});

test("mcp protocol e2e: error handling returns isError=true without crashing", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	// Invalid JSON
	const errJson = await client.callTool({
		name: "json_format",
		arguments: { json: '{"name":"Jarvis","active"}' },
	});
	assert.equal(errJson.isError, true);
	assert.match(getTextContent(errJson as any), /Invalid JSON:/);

	// Invalid Base64
	const errB64 = await client.callTool({
		name: "base64_decode",
		arguments: { encoded: "invalid-base64!@#" },
	});
	assert.equal(errB64.isError, true);
	assert.match(getTextContent(errB64 as any), /Invalid Base64 string/);

	// Unsupported Hash Algorithm
	const errHash = await client.callTool({
		name: "hash_text",
		arguments: { text: "data", algorithm: "MD5" },
	});
	assert.equal(errHash.isError, true);
	assert.match(getTextContent(errHash as any), /Input validation error/);

	// Invalid URL
	const errUrl = await client.callTool({
		name: "url_parse",
		arguments: { url: "invalid-url" },
	});
	assert.equal(errUrl.isError, true);
	assert.match(getTextContent(errUrl as any), /Invalid URL/);

	// Missing parameter
	const errMissing = await client.callTool({
		name: "base64_encode",
		arguments: {},
	});
	assert.equal(errMissing.isError, true);
	assert.match(getTextContent(errMissing as any), /Input validation error/);

	// Invalid profile parameter
	const errProfile = await client.callTool({
		name: "validate_agent_profile",
		arguments: { profile: "not-json" },
	});
	assert.equal(errProfile.isError, true);
	assert.match(getTextContent(errProfile as any), /Invalid JSON/);

	await client.close();
});

test("mcp protocol e2e: invokes discovery tools (validate_agent_profile, search_mcp_registry, get_mcp_server_details)", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	// 1. validate_agent_profile
	const validProfile = {
		id: "manual:agent-alpha",
		name: "Agent Alpha",
		description: "Test agent for protocol verification",
		source: {
			type: "manual",
			name: "Manual Entry",
			url: "https://example.com/agents/alpha",
			identifier: "agent-alpha",
		},
		classification: {
			capabilities: ["testing"],
			skills: ["ping"],
			categories: ["utility"],
			tags: ["test", "demo"],
		},
		communication: {
			protocols: ["mcp"],
			endpoint: "https://example.com/mcp",
		},
		metadata: {
			version: "1.0.0",
			discoveryTimestamp: new Date().toISOString(),
		},
		trust: {
			status: "declared",
			notes: "Self-declared test",
		},
	};

	const resVal = await client.callTool({
		name: "validate_agent_profile",
		arguments: { profile: validProfile },
	});
	assert.equal(resVal.isError, undefined);
	const valResult = JSON.parse(getTextContent(resVal as any));
	assert.equal(valResult.valid, true);
	assert.equal(valResult.normalizedProfile.name, "Agent Alpha");
	assert.equal(valResult.normalizedProfile.trust.status, "declared");

	// 2. search_mcp_registry and get_mcp_server_details with mocked global fetch
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const urlStr =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (urlStr.includes("/v0.1/servers?")) {
				return new Response(
					JSON.stringify({
						servers: [
							{
								server: {
									name: "io.github.test/search-server",
									description: "Registry test server",
									version: "1.2.0",
									remotes: [{ type: "http", url: "https://test.io/mcp" }],
								},
								_meta: {},
							},
						],
						metadata: { count: 1 },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}

			if (urlStr.includes("/v0.1/servers/io.github.test%2Fsearch-server/versions/1.2.0")) {
				return new Response(
					JSON.stringify({
						server: {
							name: "io.github.test/search-server",
							description: "Registry test server details",
							version: "1.2.0",
							remotes: [{ type: "http", url: "https://test.io/mcp" }],
						},
						_meta: {},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}

			return new Response("Not Found", { status: 404 });
		}) as typeof fetch;

		// Call search_mcp_registry
		const resSearch = await client.callTool({
			name: "search_mcp_registry",
			arguments: { query: "search-server", limit: 5 },
		});
		assert.equal(resSearch.isError, undefined);
		const searchResult = JSON.parse(getTextContent(resSearch as any));
		assert.equal(searchResult.count, 1);
		assert.equal(
			searchResult.profiles[0].id,
			"mcp-registry:io.github.test/search-server@1.2.0",
		);
		assert.equal(searchResult.profiles[0].trust.status, "declared");

		// Call get_mcp_server_details
		const resDetail = await client.callTool({
			name: "get_mcp_server_details",
			arguments: { server_name: "io.github.test/search-server", version: "1.2.0" },
		});
		assert.equal(resDetail.isError, undefined);
		const detailResult = JSON.parse(getTextContent(resDetail as any));
		assert.equal(detailResult.name, "io.github.test/search-server");
		assert.equal(detailResult.metadata.version, "1.2.0");
	} finally {
		globalThis.fetch = originalFetch;
	}

	await client.close();
});

test("mcp protocol e2e: full session connects, lists 8 tools, and calls all 8 tools", async () => {
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const urlStr =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (urlStr.includes("/v0.1/servers?")) {
				return new Response(
					JSON.stringify({
						servers: [
							{
								server: {
									name: "ac.inference.sh/mcp",
									title: "inference.sh",
									description: "AI model toolkit",
									version: "1.0.0",
									remotes: [
										{
											type: "streamable-http",
											url: "https://api.inference.sh/mcp",
										},
									],
								},
								_meta: {},
							},
						],
						metadata: { count: 1 },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			if (urlStr.includes("/v0.1/servers/ac.inference.sh%2Fmcp/versions/1.0.0")) {
				return new Response(
					JSON.stringify({
						server: {
							name: "ac.inference.sh/mcp",
							title: "inference.sh",
							description: "AI model toolkit",
							version: "1.0.0",
							remotes: [
								{ type: "streamable-http", url: "https://api.inference.sh/mcp" },
							],
						},
						_meta: {},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("Not Found", { status: 404 });
		}) as typeof fetch;

		const transport = createTestTransport();
		const client = new Client({ name: "e2e-all-8-client", version: "1.0.0" });
		await client.connect(transport);

		// List tools
		const toolsList = await client.listTools();
		assert.equal(toolsList.tools.length, 8);

		// 1. json_format
		const r1 = await client.callTool({
			name: "json_format",
			arguments: { json: '{"a":1}' },
		});
		assert.equal(r1.isError, undefined);

		// 2. base64_encode
		const r2 = await client.callTool({
			name: "base64_encode",
			arguments: { text: "test" },
		});
		assert.equal(getTextContent(r2 as any), "dGVzdA==");

		// 3. base64_decode
		const r3 = await client.callTool({
			name: "base64_decode",
			arguments: { encoded: "dGVzdA==" },
		});
		assert.equal(getTextContent(r3 as any), "test");

		// 4. hash_text
		const r4 = await client.callTool({
			name: "hash_text",
			arguments: { text: "abc", algorithm: "SHA-256" },
		});
		assert.equal(r4.isError, undefined);

		// 5. url_parse
		const r5 = await client.callTool({
			name: "url_parse",
			arguments: { url: "https://example.com/test" },
		});
		assert.equal(r5.isError, undefined);

		// 6. search_mcp_registry
		const r6 = await client.callTool({
			name: "search_mcp_registry",
			arguments: { query: "inference" },
		});
		assert.equal(r6.isError, undefined);
		const s6 = JSON.parse(getTextContent(r6 as any));
		assert.equal(s6.count, 1);

		// 7. get_mcp_server_details
		const r7 = await client.callTool({
			name: "get_mcp_server_details",
			arguments: { server_name: "ac.inference.sh/mcp", version: "1.0.0" },
		});
		assert.equal(r7.isError, undefined);
		const s7 = JSON.parse(getTextContent(r7 as any));
		assert.equal(s7.name, "inference.sh");

		// 8. validate_agent_profile
		const r8 = await client.callTool({
			name: "validate_agent_profile",
			arguments: { profile: { name: "Agent 8" } },
		});
		assert.equal(r8.isError, undefined);
		const s8 = JSON.parse(getTextContent(r8 as any));
		assert.equal(s8.valid, true);

		await client.close();
	} finally {
		globalThis.fetch = originalFetch;
	}
});
