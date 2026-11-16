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

test("mcp protocol e2e: connects, initializes, and lists exactly 11 tools", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	const toolsList = await client.listTools();
	assert.equal(toolsList.tools.length, 11);

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
		"discover_a2a_agent",
		"search_github_agents",
		"get_github_agent_details",
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

	// Invalid discover_a2a_agent parameter (SSRF target)
	const errA2a = await client.callTool({
		name: "discover_a2a_agent",
		arguments: { agent_url: "http://localhost:8080" },
	});
	assert.equal(errA2a.isError, true);
	assert.match(getTextContent(errA2a as any), /A2A Agent discovery failed|Security violation/);

	// Invalid search_github_agents parameter (empty query)
	const errGhSearch = await client.callTool({
		name: "search_github_agents",
		arguments: { query: "" },
	});
	assert.equal(errGhSearch.isError, true);
	assert.match(getTextContent(errGhSearch as any), /Input validation error|cannot be empty/i);

	// Invalid get_github_agent_details parameter (invalid owner with path traversal)
	const errGhDetails = await client.callTool({
		name: "get_github_agent_details",
		arguments: { owner: "../bad", repo: "test" },
	});
	assert.equal(errGhDetails.isError, true);
	assert.match(getTextContent(errGhDetails as any), /Input validation error|alphanumeric/i);

	// Invalid get_mcp_server_details parameter (empty server_name)
	const errMcpDetails = await client.callTool({
		name: "get_mcp_server_details",
		arguments: { server_name: "" },
	});
	assert.equal(errMcpDetails.isError, true);
	assert.match(getTextContent(errMcpDetails as any), /Input validation error|cannot be empty/i);

	// Invalid search_mcp_registry parameter (query < 3 chars)
	const errMcpSearch = await client.callTool({
		name: "search_mcp_registry",
		arguments: { query: "ab" },
	});
	assert.equal(errMcpSearch.isError, true);
	assert.match(getTextContent(errMcpSearch as any), /Input validation error|at least 3 characters/i);

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

test("mcp protocol e2e: full session connects, lists 11 tools, and calls all 11 tools", async () => {
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
			if (urlStr === "https://test-agent.example.com/.well-known/agent-card.json") {
				return new Response(
					JSON.stringify({
						name: "Test A2A Agent",
						description: "AI agent toolkit",
						version: "1.0.0",
						supportedInterfaces: [
							{
								url: "https://test-agent.example.com/a2a",
								protocolBinding: "JSON-RPC",
								protocolVersion: "1.0",
							},
						],
						capabilities: {
							streaming: false,
						},
						skills: [
							{
								name: "echo",
								description: "Echo input",
							},
						],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			if (urlStr.includes("api.github.com/search/repositories")) {
				return new Response(
					JSON.stringify({
						total_count: 1,
						incomplete_results: false,
						items: [
							{
								id: 99901,
								name: "langgraph",
								full_name: "langchain-ai/langgraph",
								private: false,
								owner: { login: "langchain-ai", id: 101 },
								html_url: "https://github.com/langchain-ai/langgraph",
								description: "Build resilient language agents as graphs",
								fork: false,
								url: "https://api.github.com/repos/langchain-ai/langgraph",
								created_at: "2024-01-01T00:00:00Z",
								updated_at: "2024-06-01T00:00:00Z",
								pushed_at: "2024-06-01T00:00:00Z",
								homepage: "https://langchain-ai.github.io/langgraph/",
								size: 1024,
								stargazers_count: 5000,
								watchers_count: 5000,
								language: "Python",
								forks_count: 600,
								open_issues_count: 25,
								default_branch: "main",
								topics: ["agent", "langchain", "multi-agent"],
								license: { key: "mit", name: "MIT License", spdx_id: "MIT" },
							},
						],
					}),
					{
						status: 200,
						headers: {
							"Content-Type": "application/json",
							"x-ratelimit-remaining": "50",
						},
					},
				);
			}
			if (urlStr.includes("api.github.com/repos/langchain-ai/langgraph/readme")) {
				return new Response(
					JSON.stringify({
						name: "README.md",
						path: "README.md",
						sha: "readme_sha",
						size: 60,
						url: "https://api.github.com/repos/langchain-ai/langgraph/contents/README.md",
						html_url: "https://github.com/langchain-ai/langgraph/blob/main/README.md",
						type: "file",
						content: Buffer.from(
							"# LangGraph\nagent.run()\ntools = [calculator]",
						).toString("base64"),
						encoding: "base64",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			if (urlStr.includes("api.github.com/repos/langchain-ai/langgraph")) {
				return new Response(
					JSON.stringify({
						id: 99901,
						name: "langgraph",
						full_name: "langchain-ai/langgraph",
						private: false,
						owner: { login: "langchain-ai", id: 101 },
						html_url: "https://github.com/langchain-ai/langgraph",
						description: "Build resilient language agents as graphs",
						fork: false,
						url: "https://api.github.com/repos/langchain-ai/langgraph",
						created_at: "2024-01-01T00:00:00Z",
						updated_at: "2024-06-01T00:00:00Z",
						pushed_at: "2024-06-01T00:00:00Z",
						size: 1024,
						stargazers_count: 5000,
						watchers_count: 5000,
						language: "Python",
						forks_count: 600,
						open_issues_count: 25,
						default_branch: "main",
						topics: ["agent", "langchain", "multi-agent"],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}
			return new Response("Not Found", { status: 404 });
		}) as typeof fetch;

		const transport = createTestTransport();
		const client = new Client({ name: "e2e-all-11-client", version: "1.0.0" });
		await client.connect(transport);

		// List tools
		const toolsList = await client.listTools();
		assert.equal(toolsList.tools.length, 11);

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

		// 9. discover_a2a_agent
		const r9 = await client.callTool({
			name: "discover_a2a_agent",
			arguments: { agent_url: "https://test-agent.example.com" },
		});
		assert.equal(r9.isError, undefined);
		const s9 = JSON.parse(getTextContent(r9 as any));
		assert.equal(s9.agent.name, "Test A2A Agent");
		assert.equal(s9.profile.source.type, "a2a");
		assert.equal(s9.profile.trust.status, "declared");
		assert.equal(s9.profile.classification.skills[0], "echo");

		// 10. search_github_agents
		const r10 = await client.callTool({
			name: "search_github_agents",
			arguments: { query: "langgraph" },
		});
		assert.equal(r10.isError, undefined);
		const s10 = JSON.parse(getTextContent(r10 as any));
		assert.equal(s10.count, 1);
		assert.equal(s10.repositories[0].name, "langgraph");
		assert.equal(s10.profiles[0].id, "github:langchain-ai/langgraph");
		assert.equal(s10.profiles[0].trust.status, "declared");

		// 11. get_github_agent_details
		const r11 = await client.callTool({
			name: "get_github_agent_details",
			arguments: { owner: "langchain-ai", repo: "langgraph", include_readme: true },
		});
		assert.equal(r11.isError, undefined);
		const s11 = JSON.parse(getTextContent(r11 as any));
		assert.equal(s11.status, "success");
		assert.equal(s11.repository.name, "langgraph");
		assert.ok(s11.readme);
		assert.equal(s11.profile.source.type, "github");
		assert.equal(s11.profile.trust.status, "declared");

		await client.close();
	} finally {
		globalThis.fetch = originalFetch;
	}
});
