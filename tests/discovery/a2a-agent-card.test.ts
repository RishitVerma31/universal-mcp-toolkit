import test from "node:test";
import assert from "node:assert/strict";
import {
	a2aV1AgentCardSchema,
	a2aLegacyV03AgentCardSchema,
	detectA2aCardVersion,
	parseA2aAgentCard,
	safeParseA2aAgentCard,
} from "../../src/discovery/connectors/a2a/agent-card-schema.ts";

test("a2aV1AgentCardSchema: validates an official A2A v1.0 specification-compliant Agent Card", () => {
	const officialV1Fixture = {
		name: "GeoSpatial Route Planner Agent",
		description: "Provides advanced route planning and traffic analysis.",
		version: "1.2.0",
		supportedInterfaces: [
			{
				url: "https://geo-agent.example.com/a2a/v1",
				protocolBinding: "JSONRPC",
				protocolVersion: "1.0",
			},
			{
				url: "https://geo-agent.example.com/mcp",
				protocolBinding: "MCP",
				protocolVersion: "2024-11-05",
				tenant: "tenant-enterprise",
			},
		],
		provider: {
			organization: "Example Geo Services Inc.",
			url: "https://www.examplegeoservices.com",
			supportContact: "support@examplegeoservices.com",
		},
		capabilities: {
			streaming: true,
			pushNotifications: false,
			extendedAgentCard: true,
		},
		defaultInputModes: ["text/plain", "application/json"],
		defaultOutputModes: ["application/json"],
		skills: [
			{
				id: "plan-route",
				name: "Plan Route",
				description: "Calculates optimal travel routes.",
				tags: ["routing", "navigation"],
				examples: ["Calculate route from point A to point B"],
				inputModes: ["application/json"],
				outputModes: ["application/json"],
			},
		],
		securitySchemes: {
			corporateOAuth: {
				type: "oauth2",
				description: "OAuth 2.0 flow for partner agents",
				flows: {
					clientCredentials: {
						tokenUrl: "https://auth.example.com/oauth/token",
						scopes: { "agent:invoke": "Invoke agent skills" },
					},
				},
			},
			apiKeyAuth: {
				type: "apiKey",
				name: "X-API-Key",
				in: "header",
			},
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			},
			oidcAuth: {
				type: "openIdConnect",
				openIdConnectUrl: "https://auth.example.com/.well-known/openid-configuration",
			},
			mtlsAuth: {
				type: "mutualTLS",
				description: "mTLS authentication for internal mesh",
			},
		},
		securityRequirements: [{ corporateOAuth: ["agent:invoke"] }, { apiKeyAuth: [] }],
		signatures: [
			{
				protected: "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpPU0UiLCJraWQiOiJrZXktMSJ9",
				signature: "QFdkNLNszlGj3z3u0YQGt_T9LixY3qtdQpZmsTdDHDe3fXV9y9",
				header: { alg: "ES256" },
			},
		],
		documentationUrl: "https://docs.examplegeoservices.com/agent",
		iconUrl: "https://examplegeoservices.com/icon.svg",
		"x-custom-engine": "v8-edge",
	};

	const parsed = a2aV1AgentCardSchema.parse(officialV1Fixture);
	assert.equal(parsed.name, "GeoSpatial Route Planner Agent");
	assert.equal(parsed.version, "1.2.0");
	assert.equal(parsed.provider?.organization, "Example Geo Services Inc.");
	assert.equal(parsed.supportedInterfaces.length, 2);
	assert.equal(parsed.supportedInterfaces[0].protocolBinding, "JSONRPC");
	assert.equal(parsed.supportedInterfaces[0].protocolVersion, "1.0");
	assert.equal(parsed.capabilities?.streaming, true);
	assert.equal(parsed.capabilities?.extendedAgentCard, true);
	assert.equal(parsed.signatures?.length, 1);
	assert.equal(
		parsed.signatures?.[0].signature,
		"QFdkNLNszlGj3z3u0YQGt_T9LixY3qtdQpZmsTdDHDe3fXV9y9",
	);
	assert.equal((parsed as any)["x-custom-engine"], "v8-edge");
});

test("a2aLegacyV03AgentCardSchema: validates an official legacy v0.3 Agent Card", () => {
	const officialLegacyV03Fixture = {
		name: "LegacyV03Agent",
		description: "An agent adhering to v0.3 legacy specification.",
		version: "0.3.5",
		agentVersion: "0.3.5",
		schemaVersion: "0.3",
		protocolVersion: "0.3",
		url: "https://legacy.example.com/api/tasks",
		provider: {
			name: "Legacy Corporation",
			url: "https://legacy.example.com",
		},
		skills: [
			{
				name: "legacyTask",
				description: "Executes legacy tasks",
			},
		],
	};

	const parsed = a2aLegacyV03AgentCardSchema.parse(officialLegacyV03Fixture);
	assert.equal(parsed.name, "LegacyV03Agent");
	assert.equal(parsed.schemaVersion, "0.3");
	assert.equal(parsed.agentVersion, "0.3.5");
	assert.equal(parsed.url, "https://legacy.example.com/api/tasks");
	assert.equal(parsed.provider?.name, "Legacy Corporation");
});

test("detectA2aCardVersion: accurately determines specVersion", () => {
	assert.equal(
		detectA2aCardVersion({
			name: "v1-agent",
			supportedInterfaces: [
				{
					url: "https://agent.example.com",
					protocolBinding: "JSONRPC",
					protocolVersion: "1.0",
				},
			],
		}),
		"v1.0",
	);

	assert.equal(
		detectA2aCardVersion({
			name: "v03-agent",
			schemaVersion: "0.3",
			url: "https://agent.example.com",
		}),
		"v0.3",
	);

	assert.equal(
		detectA2aCardVersion({
			name: "v03-url-agent",
			url: "https://agent.example.com",
		}),
		"v0.3",
	);
});

test("a2aV1AgentCardSchema: rejects cross-version hybrid documents", () => {
	// 1. Rejects top-level protocolVersion in v1.0
	const hybridWithProtocolVersion = {
		name: "HybridAgent",
		protocolVersion: "1.0", // Invalid in v1.0 (removed from top-level)
		supportedInterfaces: [
			{
				url: "https://agent.example.com",
				protocolBinding: "JSONRPC",
				protocolVersion: "1.0",
			},
		],
	};
	assert.throws(
		() => a2aV1AgentCardSchema.parse(hybridWithProtocolVersion),
		/top-level 'protocolVersion' was removed in v1.0/i,
	);

	// 2. Rejects top-level url in v1.0
	const hybridWithUrl = {
		name: "HybridAgent",
		url: "https://agent.example.com", // Invalid in v1.0
		supportedInterfaces: [
			{
				url: "https://agent.example.com",
				protocolBinding: "JSONRPC",
				protocolVersion: "1.0",
			},
		],
	};
	assert.throws(
		() => a2aV1AgentCardSchema.parse(hybridWithUrl),
		/top-level 'url' was replaced by 'supportedInterfaces' in v1.0/i,
	);

	// 3. Rejects agentVersion in v1.0
	const hybridWithAgentVersion = {
		name: "HybridAgent",
		agentVersion: "1.0.0", // Invalid in v1.0
		supportedInterfaces: [
			{
				url: "https://agent.example.com",
				protocolBinding: "JSONRPC",
				protocolVersion: "1.0",
			},
		],
	};
	assert.throws(
		() => a2aV1AgentCardSchema.parse(hybridWithAgentVersion),
		/'agentVersion' is a legacy v0.3 field/i,
	);

	// 4. Rejects schemaVersion: "0.3" in v1.0
	const hybridWithSchemaVersion = {
		name: "HybridAgent",
		schemaVersion: "0.3",
		supportedInterfaces: [
			{
				url: "https://agent.example.com",
				protocolBinding: "JSONRPC",
				protocolVersion: "1.0",
			},
		],
	};
	assert.throws(
		() => a2aV1AgentCardSchema.parse(hybridWithSchemaVersion),
		/conflicting legacy 'schemaVersion: 0.3'/i,
	);
});

test("a2aLegacyV03AgentCardSchema: rejects cards attempting to use v1.0 features", () => {
	const legacyWithV1Interfaces = {
		name: "InvalidLegacyAgent",
		schemaVersion: "0.3",
		url: "https://legacy.example.com/api",
		supportedInterfaces: [
			{
				url: "https://agent.example.com",
				protocolBinding: "JSONRPC",
				protocolVersion: "1.0",
			},
		],
	};
	assert.throws(
		() => a2aLegacyV03AgentCardSchema.parse(legacyWithV1Interfaces),
		/'supportedInterfaces' is an A2A v1.0 field/i,
	);

	const legacyWithSignatures = {
		name: "InvalidLegacyAgent",
		schemaVersion: "0.3",
		url: "https://legacy.example.com/api",
		signatures: [{ protected: "eyJhbGciOiJFUzI1NiJ9", signature: "c2lnbmF0dXJl" }],
	};
	assert.throws(
		() => a2aLegacyV03AgentCardSchema.parse(legacyWithSignatures),
		/'signatures' is an A2A v1.0 field/i,
	);
});

test("a2aV1AgentCardSchema: enforces discriminated union on securitySchemes", () => {
	// Invalid apiKey location
	assert.throws(
		() =>
			a2aV1AgentCardSchema.parse({
				name: "SecureAgent",
				supportedInterfaces: [
					{
						url: "https://agent.example.com",
						protocolBinding: "JSONRPC",
						protocolVersion: "1.0",
					},
				],
				securitySchemes: {
					badKey: {
						type: "apiKey",
						name: "api_key",
						in: "body", // Invalid location
					},
				},
			}),
		/apiKey 'in' location must be/i,
	);

	// Missing HTTP scheme (e.g. bearer)
	assert.throws(
		() =>
			a2aV1AgentCardSchema.parse({
				name: "SecureAgent",
				supportedInterfaces: [
					{
						url: "https://agent.example.com",
						protocolBinding: "JSONRPC",
						protocolVersion: "1.0",
					},
				],
				securitySchemes: {
					badHttp: {
						type: "http",
						// missing scheme
					},
				},
			}),
		/Required|expected string|invalid_type|http security scheme requires a scheme/i,
	);

	// Missing openIdConnectUrl
	assert.throws(
		() =>
			a2aV1AgentCardSchema.parse({
				name: "SecureAgent",
				supportedInterfaces: [
					{
						url: "https://agent.example.com",
						protocolBinding: "JSONRPC",
						protocolVersion: "1.0",
					},
				],
				securitySchemes: {
					badOidc: {
						type: "openIdConnect",
						// missing openIdConnectUrl
					},
				},
			}),
		/Required|expected string|invalid_type|openIdConnect security scheme requires openIdConnectUrl/i,
	);
});

test("parseA2aAgentCard & safeParseA2aAgentCard: parse valid cards with explicit specVersion", () => {
	const validV1 = {
		name: "V1Agent",
		supportedInterfaces: [
			{
				url: "https://agent.example.com/api",
				protocolBinding: "JSONRPC",
				protocolVersion: "1.0",
			},
		],
		provider: { organization: "OpenOrg" },
	};

	const parsedV1 = parseA2aAgentCard(validV1);
	assert.equal(parsedV1.specVersion, "v1.0");
	assert.equal(parsedV1.name, "V1Agent");

	const safeV1 = safeParseA2aAgentCard(validV1);
	assert.equal(safeV1.success, true);
	if (safeV1.success) {
		assert.equal(safeV1.data.specVersion, "v1.0");
	}

	const validLegacy = {
		name: "V03Agent",
		schemaVersion: "0.3",
		url: "https://legacy.example.com/api",
	};

	const parsedLegacy = parseA2aAgentCard(validLegacy);
	assert.equal(parsedLegacy.specVersion, "v0.3");
	assert.equal(parsedLegacy.name, "V03Agent");

	const safeLegacy = safeParseA2aAgentCard(validLegacy);
	assert.equal(safeLegacy.success, true);
	if (safeLegacy.success) {
		assert.equal(safeLegacy.data.specVersion, "v0.3");
	}
});
