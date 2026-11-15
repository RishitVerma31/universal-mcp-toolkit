import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMcpRegistryServer } from "../../src/discovery/normalizer/mcp-registry-normalizer.ts";
import type { McpRegistryServerEntry } from "../../src/discovery/connectors/mcp-registry/types.ts";

test("normalizer: maps full MCP registry server entry to AgentProfile", () => {
	const entry: McpRegistryServerEntry = {
		server: {
			name: "com.github.acme/analytics",
			title: "Acme Analytics Server",
			description: "Real-time analytics integration for MCP clients",
			version: "3.1.4",
			remotes: [
				{ type: "streamable-http", url: "https://analytics.acme.com/mcp" },
				{ type: "sse", url: "https://analytics.acme.com/sse" },
			],
			repository: {
				url: "https://github.com/acme/analytics",
				source: "github",
			},
			packages: [{ registry: "npm", name: "@acme/analytics-mcp", version: "3.1.4" }],
		},
		_meta: {
			"io.modelcontextprotocol.registry/official": {
				status: "active",
				publishedAt: "2026-05-10T12:00:00Z",
				updatedAt: "2026-05-11T15:30:00Z",
				isLatest: true,
			},
		},
	};

	const profile = normalizeMcpRegistryServer(entry);

	assert.equal(profile.id, "mcp-registry:com.github.acme/analytics@3.1.4");
	assert.equal(profile.name, "Acme Analytics Server");
	assert.equal(profile.description, "Real-time analytics integration for MCP clients");
	assert.equal(profile.source.type, "mcp-registry");
	assert.equal(profile.source.identifier, "com.github.acme/analytics");
	assert.equal(profile.source.url, "https://github.com/acme/analytics");

	// Communication
	assert.ok(profile.communication.protocols.includes("mcp"));
	assert.ok(profile.communication.protocols.includes("streamable-http"));
	assert.ok(profile.communication.protocols.includes("sse"));
	assert.ok(profile.communication.protocols.includes("stdio"));
	assert.equal(profile.communication.endpoint, "https://analytics.acme.com/mcp");

	// Trust status must be "declared", not "verified"
	assert.equal(profile.trust.status, "declared");
	assert.match(profile.trust.notes || "", /unverified/);

	// Capabilities & skills
	assert.ok(profile.classification.capabilities.includes("mcp:server"));
	assert.ok(profile.classification.capabilities.includes("remote-mcp"));
	assert.ok(profile.classification.capabilities.includes("package-installable"));
	assert.deepEqual(profile.classification.skills, []); // Must not fabricate skills

	// Metadata
	assert.equal(profile.metadata.version, "3.1.4");
	assert.equal(profile.metadata.provider, "com.github.acme");
	assert.equal(profile.metadata.lastUpdated, "2026-05-11T15:30:00Z");
});

test("normalizer: handles minimal registry server without remotes or packages", () => {
	const entry: McpRegistryServerEntry = {
		server: {
			name: "minimal-tool",
			version: "0.0.1",
		},
	};

	const profile = normalizeMcpRegistryServer(entry);

	assert.equal(profile.name, "minimal-tool"); // falls back to name
	assert.equal(profile.description, "");
	assert.deepEqual(profile.communication.protocols, ["mcp"]);
	assert.equal(profile.communication.endpoint, undefined);
	assert.equal(profile.trust.status, "declared");
});
