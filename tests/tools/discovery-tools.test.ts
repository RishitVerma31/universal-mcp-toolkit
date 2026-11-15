import test from "node:test";
import assert from "node:assert/strict";
import {
	handleSearchMcpRegistry,
	searchMcpRegistryInputSchema,
} from "../../src/tools/discovery/search-mcp-registry.ts";
import {
	handleGetMcpServerDetails,
	getMcpServerDetailsInputSchema,
} from "../../src/tools/discovery/get-mcp-server-details.ts";
import {
	handleValidateAgentProfile,
	validateAgentProfileInputSchema,
} from "../../src/tools/discovery/validate-agent-profile.ts";
import { DiscoveryEngine } from "../../src/discovery/search/discovery-engine.ts";
import type { DiscoveryConnector } from "../../src/discovery/types/connector.ts";
import type { AgentProfile } from "../../src/discovery/types/agent-profile.ts";

function createMockConnector(overrides: Partial<DiscoveryConnector> = {}): DiscoveryConnector {
	const dummyProfile: AgentProfile = {
		id: "mcp-registry:test/calc@1.0.0",
		name: "Calculator",
		description: "Math tools",
		source: {
			type: "mcp-registry",
			name: "Model Context Protocol Registry",
			url: "https://example.com",
			identifier: "test/calc",
		},
		classification: {
			capabilities: ["mcp:server"],
			skills: [],
			categories: ["mcp-server"],
			tags: [],
		},
		communication: {
			protocols: ["mcp"],
		},
		authentication: {
			required: false,
			declaredMethods: ["none"],
		},
		io: {
			supportedInputs: ["tool-call"],
			supportedOutputs: ["tool-result"],
		},
		metadata: {
			version: "1.0.0",
			discoveryTimestamp: new Date().toISOString(),
		},
		trust: {
			status: "declared",
		},
	};

	return {
		id: "mcp-registry",
		name: "Mock Registry",
		search:
			overrides.search ||
			(async () => ({
				profiles: [dummyProfile],
				totalCount: 1,
				nextCursor: null,
				source: "mock-source",
			})),
		getDetails:
			overrides.getDetails || (async (id) => (id === "test/calc" ? dummyProfile : null)),
	};
}

test("search_mcp_registry: tool handler returns formatted results", async () => {
	const engine = new DiscoveryEngine([createMockConnector()]);
	const result = await handleSearchMcpRegistry({ query: "calc", limit: 10 }, engine);

	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].type, "text");
	const data = JSON.parse(result.content[0].text);
	assert.equal(data.query, "calc");
	assert.equal(data.count, 1);
	assert.equal(data.profiles[0].name, "Calculator");
});

test("search_mcp_registry: handles engine error gracefully with isError=true", async () => {
	const failingConnector = createMockConnector({
		search: async () => {
			throw new Error("Registry network connection failed");
		},
	});
	const engine = new DiscoveryEngine([failingConnector]);
	const result = await handleSearchMcpRegistry({ query: "fail", limit: 20 }, engine);

	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /Registry network connection failed/);
});

test("search_mcp_registry: schema validates query and limits", () => {
	const parsed = searchMcpRegistryInputSchema.parse({ query: "test" });
	assert.equal(parsed.limit, 20); // default limit
	assert.equal(parsed.latest_only, true); // default latest_only

	assert.throws(() => {
		searchMcpRegistryInputSchema.parse({ query: "" }); // empty query rejected
	});

	assert.throws(() => {
		searchMcpRegistryInputSchema.parse({ query: "ab" }); // less than 3 chars rejected
	});

	assert.throws(() => {
		searchMcpRegistryInputSchema.parse({ query: "  ab  " }); // trimmed less than 3 chars rejected
	});

	assert.throws(() => {
		searchMcpRegistryInputSchema.parse({ query: "test", limit: 0 }); // min 1
	});

	assert.throws(() => {
		searchMcpRegistryInputSchema.parse({ query: "test", limit: 150 }); // max 100
	});
});

test("get_mcp_server_details: returns profile for existing server", async () => {
	const engine = new DiscoveryEngine([createMockConnector()]);
	const result = await handleGetMcpServerDetails(
		{ server_name: "test/calc", version: "1.0.0" },
		engine,
	);

	assert.equal(result.isError, undefined);
	const profile = JSON.parse(result.content[0].text);
	assert.equal(profile.id, "mcp-registry:test/calc@1.0.0");
	assert.equal(profile.name, "Calculator");
});

test("get_mcp_server_details: returns structured error for non-existent server", async () => {
	const engine = new DiscoveryEngine([createMockConnector()]);
	const result = await handleGetMcpServerDetails(
		{ server_name: "nonexistent/server", version: "latest" },
		engine,
	);

	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /not found/);
});

test("get_mcp_server_details: schema validates non-empty server_name", () => {
	assert.throws(() => {
		getMcpServerDetailsInputSchema.parse({ server_name: "" });
	});
});

test("validate_agent_profile: validates and normalizes valid candidate profile object", async () => {
	const candidate = {
		name: "My Assistant",
		description: "Personal AI agent",
	};

	const result = await handleValidateAgentProfile({ profile: candidate, normalize: true });
	assert.equal(result.isError, undefined);
	const data = JSON.parse(result.content[0].text);
	assert.equal(data.valid, true);
	assert.equal(data.normalizedProfile.name, "My Assistant");
	assert.equal(data.normalizedProfile.trust.status, "declared");
});

test("validate_agent_profile: validates JSON string representation", async () => {
	const jsonStr = JSON.stringify({ name: "String Agent" });
	const result = await handleValidateAgentProfile({ profile: jsonStr, normalize: true });

	assert.equal(result.isError, undefined);
	const data = JSON.parse(result.content[0].text);
	assert.equal(data.valid, true);
	assert.equal(data.normalizedProfile.name, "String Agent");
});

test("validate_agent_profile: handles malformed JSON string gracefully", async () => {
	const result = await handleValidateAgentProfile({ profile: "{ not json }", normalize: true });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /Invalid JSON provided/);
});

test("validate_agent_profile: rejects objects with excessive keys to prevent resource exhaustion", async () => {
	const hugeObject: Record<string, string> = {};
	for (let i = 0; i < 105; i++) {
		hugeObject[`key_${i}`] = `val_${i}`;
	}
	const result = await handleValidateAgentProfile({ profile: hugeObject, normalize: true });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /excessive top-level keys/);
});

test("validate_agent_profile: rejects deeply nested objects exceeding max recursion depth", async () => {
	let deep: any = { leaf: true };
	for (let i = 0; i < 8; i++) {
		deep = { nested: deep };
	}
	const result = await handleValidateAgentProfile({ profile: deep, normalize: true });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /maximum allowed nesting depth/);
});

test("validate_agent_profile: schema accepts both object and string", () => {
	assert.ok(validateAgentProfileInputSchema.parse({ profile: { name: "Agent" } }));
	assert.ok(validateAgentProfileInputSchema.parse({ profile: '{"name": "Agent"}' }));
});
