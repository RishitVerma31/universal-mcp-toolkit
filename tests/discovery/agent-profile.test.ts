import test from "node:test";
import assert from "node:assert/strict";
import {
	agentProfileSchema,
	trustStatusSchema,
	agentSourceTypeSchema,
} from "../../src/discovery/types/agent-profile.ts";
import { validateAndNormalizeProfile } from "../../src/discovery/normalizer/profile-validator.ts";

test("agentProfileSchema: validates a complete, valid AgentProfile", () => {
	const validProfile = {
		id: "mcp-registry:io.example/test-server@1.0.0",
		name: "Test Server",
		description: "A valid test MCP server",
		source: {
			type: "mcp-registry",
			name: "Model Context Protocol Registry",
			url: "https://example.com/repo",
			identifier: "io.example/test-server",
		},
		classification: {
			capabilities: ["mcp:server", "remote-mcp"],
			skills: ["data-fetching"],
			categories: ["mcp-server", "developer-tools"],
			tags: ["test", "example"],
		},
		communication: {
			protocols: ["mcp", "streamable-http"],
			framework: "modelcontextprotocol",
			endpoint: "https://example.com/mcp",
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
			provider: "io.example",
			lastUpdated: "2026-01-01T00:00:00.000Z",
			discoveryTimestamp: "2026-02-01T12:00:00.000Z",
		},
		trust: {
			status: "declared",
			notes: "Self-declared metadata from registry.",
		},
	};

	const parsed = agentProfileSchema.parse(validProfile);
	assert.equal(parsed.id, validProfile.id);
	assert.equal(parsed.trust.status, "declared");
	assert.equal(parsed.communication.protocols.length, 2);
});

test("agentProfileSchema: applies defaults for optional subfields", () => {
	const minimalProfile = {
		id: "manual:custom-agent",
		name: "Custom Agent",
		source: {
			type: "manual",
			name: "Manual Source",
			identifier: "custom-agent",
		},
		classification: {},
		communication: {},
		authentication: {},
		io: {},
		metadata: {
			discoveryTimestamp: new Date().toISOString(),
		},
		trust: {},
	};

	const parsed = agentProfileSchema.parse(minimalProfile);
	assert.equal(parsed.description, "");
	assert.deepEqual(parsed.classification.capabilities, []);
	assert.deepEqual(parsed.communication.protocols, []);
	assert.equal(parsed.authentication.required, false);
	assert.equal(parsed.trust.status, "declared");
	assert.equal(parsed.metadata.version, undefined);
});

test("agentProfileSchema: rejects invalid required fields or incorrect types", () => {
	// Missing name
	assert.throws(() => {
		agentProfileSchema.parse({
			id: "agent:1",
			source: { type: "manual", name: "Manual", identifier: "1" },
			metadata: { discoveryTimestamp: new Date().toISOString() },
		});
	});

	// Invalid trust status
	assert.throws(() => {
		trustStatusSchema.parse("untrusted-status");
	});

	// Invalid source type
	assert.throws(() => {
		agentSourceTypeSchema.parse("unsupported-source");
	});

	// Invalid endpoint URL
	assert.throws(() => {
		agentProfileSchema.parse({
			id: "agent:1",
			name: "Bad URL Agent",
			source: { type: "manual", name: "Manual", identifier: "1" },
			communication: {
				endpoint: "not-a-valid-url",
			},
			metadata: { discoveryTimestamp: new Date().toISOString() },
		});
	});
});

test("agentProfileSchema: rejects non-http/https protocols such as javascript: and file:", () => {
	assert.throws(() => {
		agentProfileSchema.parse({
			id: "agent:xss",
			name: "XSS Agent",
			source: {
				type: "manual",
				name: "Manual",
				identifier: "xss",
				url: "javascript:alert(1)",
			},
			metadata: { discoveryTimestamp: new Date().toISOString() },
		});
	});

	assert.throws(() => {
		agentProfileSchema.parse({
			id: "agent:ssrf",
			name: "SSRF Agent",
			source: { type: "manual", name: "Manual", identifier: "ssrf" },
			communication: { endpoint: "file:///etc/passwd" },
			metadata: { discoveryTimestamp: new Date().toISOString() },
		});
	});
});

test("validateAndNormalizeProfile: normalizes raw input and reports missing optional fields and unknown properties", () => {
	const raw = {
		name: "Minimal Agent",
		description: "A minimal agent without optional fields",
		unexpected_extra_field: "this should be reported as unknown",
	};

	const result = validateAndNormalizeProfile(raw, true);
	assert.equal(result.valid, true);
	assert.ok(result.normalizedProfile);
	assert.equal(result.normalizedProfile?.name, "Minimal Agent");
	assert.equal(result.normalizedProfile?.trust.status, "declared");
	assert.ok(result.missingOptionalFields.includes("communication.endpoint"));
	assert.ok(result.missingOptionalFields.includes("metadata.provider"));
	assert.equal(result.validationErrors.length, 0);
	assert.ok(result.unknownProperties.includes("unexpected_extra_field"));
});

test("validateAndNormalizeProfile: rejects invalid candidate without normalization", () => {
	const invalidRaw = {
		// Missing id, source, metadata
		name: "Incomplete Agent",
	};

	const result = validateAndNormalizeProfile(invalidRaw, false);
	assert.equal(result.valid, false);
	assert.equal(result.normalizedProfile, null);
	assert.ok(result.validationErrors.length > 0);
});
