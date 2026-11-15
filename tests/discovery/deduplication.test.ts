import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateProfiles } from "../../src/discovery/deduplication/deduplicator.ts";
import type { AgentProfile } from "../../src/discovery/types/agent-profile.ts";

function createDummyProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
	return {
		id: overrides.id || "mcp-registry:test/server@1.0.0",
		name: overrides.name || "Test Server",
		description: "A test server",
		source: {
			type: overrides.source?.type || "mcp-registry",
			name: overrides.source?.name || "Model Context Protocol Registry",
			url: "https://example.com",
			identifier: overrides.source?.identifier || "test/server",
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
			version: overrides.metadata?.version || "1.0.0",
			discoveryTimestamp: new Date().toISOString(),
		},
		trust: {
			status: "declared",
		},
	};
}

test("deduplication: filters out exact duplicates", () => {
	const p1 = createDummyProfile({
		id: "server-a@1.0.0",
		source: { type: "mcp-registry", name: "Registry", identifier: "server-a" },
		metadata: { version: "1.0.0", discoveryTimestamp: "" },
	});
	const p2 = createDummyProfile({
		id: "server-a@1.0.0",
		source: { type: "mcp-registry", name: "Registry", identifier: "server-a" },
		metadata: { version: "1.0.0", discoveryTimestamp: "" },
	});

	const result = deduplicateProfiles([p1, p2]);
	assert.equal(result.length, 1);
	assert.equal(result[0].id, "server-a@1.0.0");
});

test("deduplication: preserves different versions of the same server", () => {
	const v1 = createDummyProfile({
		id: "server-a@1.0.0",
		source: { type: "mcp-registry", name: "Registry", identifier: "server-a" },
		metadata: { version: "1.0.0", discoveryTimestamp: "" },
	});
	const v2 = createDummyProfile({
		id: "server-a@2.0.0",
		source: { type: "mcp-registry", name: "Registry", identifier: "server-a" },
		metadata: { version: "2.0.0", discoveryTimestamp: "" },
	});

	const result = deduplicateProfiles([v1, v2]);
	assert.equal(result.length, 2);
	assert.equal(result[0].metadata.version, "1.0.0");
	assert.equal(result[1].metadata.version, "2.0.0");
});

test("deduplication: does not merge different servers sharing the same display name", () => {
	const s1 = createDummyProfile({
		id: "pkg1/calc@1.0.0",
		name: "Calculator",
		source: { type: "mcp-registry", name: "Registry", identifier: "pkg1/calc" },
	});
	const s2 = createDummyProfile({
		id: "pkg2/calc@1.0.0",
		name: "Calculator",
		source: { type: "mcp-registry", name: "Registry", identifier: "pkg2/calc" },
	});

	const result = deduplicateProfiles([s1, s2]);
	assert.equal(result.length, 2);
	assert.equal(result[0].source.identifier, "pkg1/calc");
	assert.equal(result[1].source.identifier, "pkg2/calc");
});

test("deduplication: distinguishes between different sources", () => {
	const reg = createDummyProfile({
		id: "calc@1.0.0",
		source: { type: "mcp-registry", name: "MCP Registry", identifier: "calc" },
	});
	const manual = createDummyProfile({
		id: "calc@1.0.0",
		source: { type: "manual", name: "Manual Entry", identifier: "calc" },
	});

	const result = deduplicateProfiles([reg, manual]);
	assert.equal(result.length, 2);
	assert.equal(result[0].source.type, "mcp-registry");
	assert.equal(result[1].source.type, "manual");
});
