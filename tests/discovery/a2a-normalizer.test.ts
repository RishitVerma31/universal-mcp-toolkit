import test from "node:test";
import assert from "node:assert/strict";
import { normalizeA2aAgentCard } from "../../src/discovery/normalizer/a2a-agent-card-normalizer.ts";
import type { A2AAgentCard } from "../../src/discovery/connectors/a2a/types.ts";

test("a2a normalizer: maps full v1.0 Agent Card to valid AgentProfile and safely preserves unverified signatures", () => {
	const card: A2AAgentCard = {
		specVersion: "v1.0",
		name: "DataAnalystAgent",
		description: "Specialized in running SQL and generating visual charts",
		version: "2.1.0",
		provider: {
			organization: "Analytics Inc",
			url: "https://analytics.example.com",
		},
		documentationUrl: "https://docs.analytics.example.com",
		iconUrl: "https://analytics.example.com/icon.svg",
		supportedInterfaces: [
			{
				url: "https://api.analytics.example.com/a2a",
				protocolBinding: "JSON-RPC",
				protocolVersion: "1.0",
			},
			{
				url: "https://api.analytics.example.com/mcp",
				protocolBinding: "MCP",
				protocolVersion: "2024-11-05",
			},
		],
		capabilities: {
			streaming: true,
			pushNotifications: false,
			stateTransitionHistory: true,
		},
		skills: [
			{
				id: "sql-query",
				name: "Execute SQL",
				description: "Executes read-only SQL queries",
				tags: ["sql", "database", "analytics"],
				examples: ["SELECT count(*) FROM users"],
			},
			{
				name: "Chart Generator",
				description: "Creates bar and line charts from tabular data",
				tags: ["charts", "visualization"],
			},
		],
		securitySchemes: {
			oauth2: {
				type: "oauth2",
				description: "OAuth 2.0 authorization code flow",
				flows: { clientCredentials: { tokenUrl: "https://auth.example.com/token" } },
			},
		},
		securityRequirements: [{ oauth2: ["read", "write"] }],
		signatures: [
			{
				protected: "eyJhbGciOiJFUzI1NiJ9",
				signature: "dGVzdC1zaWduYXR1cmU",
			},
		],
		customProp: "preserved-extension",
	};

	const agentCardUrl = "https://api.analytics.example.com/.well-known/agent-card.json";
	const profile = normalizeA2aAgentCard(card, agentCardUrl);

	// ID
	assert.equal(profile.id, "a2a:api.analytics.example.com/DataAnalystAgent@2.1.0");

	// Display metadata
	assert.equal(profile.name, "DataAnalystAgent");
	assert.equal(profile.description, "Specialized in running SQL and generating visual charts");

	// Source
	assert.equal(profile.source.type, "a2a");
	assert.equal(profile.source.url, "https://analytics.example.com/");
	assert.equal(profile.source.identifier, "DataAnalystAgent");

	// Trust MUST remain 'declared', never 'verified' based on signature presence alone
	assert.equal(profile.trust.status, "declared");
	assert.match(profile.trust.notes || "", /1 unverified signature\(s\) present/);

	// Classification
	assert.ok(profile.classification.categories.includes("agent"));
	assert.ok(profile.classification.categories.includes("a2a"));
	assert.ok(profile.classification.skills.includes("Execute SQL"));
	assert.ok(profile.classification.skills.includes("Chart Generator"));
	assert.ok(profile.classification.tags.includes("sql"));
	assert.ok(profile.classification.tags.includes("visualization"));
	assert.ok(profile.classification.capabilities.includes("streaming"));
	assert.ok(profile.classification.capabilities.includes("stateTransitionHistory"));

	// Communication
	assert.ok(profile.communication.protocols.includes("json-rpc"));
	assert.ok(profile.communication.protocols.includes("mcp"));
	assert.equal(profile.communication.endpoint, "https://api.analytics.example.com/a2a");

	// Metadata
	assert.equal(profile.metadata.version, "2.1.0");
	assert.equal(profile.metadata.provider, "Analytics Inc");
	assert.equal(profile.metadata.documentationUrl, "https://docs.analytics.example.com/");
	assert.equal(profile.metadata.iconUrl, "https://analytics.example.com/icon.svg");
	assert.equal(profile.metadata.a2a?.specVersion, "v1.0");
	assert.equal(profile.metadata.a2a?.protocolVersion, "1.0");
	assert.equal(profile.metadata.extra?.customProp, "preserved-extension");

	// Signatures safely preserved as unverified
	const sigMetadata = (profile.metadata.a2a as any)?.signatures;
	assert.ok(sigMetadata);
	assert.equal(sigMetadata.count, 1);
	assert.equal(sigMetadata.verified, false);
	assert.equal(sigMetadata.status, "unverified");
	assert.match(sigMetadata.note, /Cryptographic signature verification is not performed/);
	assert.equal(sigMetadata.declarations[0].signature, "dGVzdC1zaWduYXR1cmU");

	// Authentication
	assert.equal(profile.authentication.required, true);
	assert.ok(profile.authentication.declaredMethods.includes("oauth2"));
});

test("a2a normalizer: handles minimal card with legacy fallback fields", () => {
	const minimalCard: A2AAgentCard = {
		specVersion: "v0.3",
		name: "LegacyMinAgent",
		url: "https://legacy.example.com/endpoint",
	};

	const agentCardUrl = "https://legacy.example.com/.well-known/agent-card.json";
	const profile = normalizeA2aAgentCard(minimalCard, agentCardUrl);

	assert.equal(profile.id, "a2a:legacy.example.com/LegacyMinAgent@0.1.0");
	assert.equal(profile.name, "LegacyMinAgent");
	assert.equal(profile.source.type, "a2a");
	assert.equal(profile.communication.endpoint, "https://legacy.example.com/endpoint");
	assert.equal(profile.authentication.required, false);
	assert.deepEqual(profile.authentication.declaredMethods, ["none"]);
	assert.equal(profile.trust.status, "declared");
	assert.equal(profile.metadata.a2a?.specVersion, "v0.3");
});
