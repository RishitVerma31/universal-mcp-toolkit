import { z } from "zod";
import type { A2AAgentCard, A2AV1AgentCard, A2ALegacyV03AgentCard } from "./types.ts";

export const a2aV1SupportedInterfaceSchema = z
	.object({
		url: z.string().min(1, "Interface URL must be a non-empty string"),
		protocolBinding: z
			.string()
			.min(1, "Interface protocolBinding must be specified (e.g. JSONRPC, GRPC, HTTP+JSON)"),
		protocolVersion: z
			.string()
			.min(1, "Interface protocolVersion must be specified (e.g. 1.0)"),
		tenant: z.string().optional().describe("Optional multi-tenant identifier"),
	})
	.passthrough();

export const a2aV1ProviderSchema = z
	.object({
		organization: z.string().min(1, "Provider organization is required in A2A v1.0"),
		url: z.string().optional().describe("Provider website URL"),
		supportContact: z.string().optional().describe("Support email or contact URL"),
	})
	.passthrough();

export const a2aLegacyV03ProviderSchema = z
	.object({
		name: z.string().optional().describe("Legacy provider author name"),
		organization: z.string().optional().describe("Provider organization name"),
		url: z.string().optional().describe("Provider website URL"),
		supportContact: z.string().optional().describe("Support contact"),
	})
	.passthrough();

export const a2aCapabilitiesSchema = z
	.object({
		streaming: z.boolean().optional().describe("Whether real-time streaming is supported"),
		pushNotifications: z
			.boolean()
			.optional()
			.describe("Whether asynchronous push notifications are supported"),
		extendedAgentCard: z
			.boolean()
			.optional()
			.describe("Whether an authenticated extended agent card is available"),
		a2aVersion: z.string().optional().describe("A2A protocol specification version"),
		supportedMessageParts: z
			.array(z.string())
			.optional()
			.describe("Supported message part types (e.g. text, file, data)"),
	})
	.passthrough();

export const a2aSkillExampleSchema = z.union([
	z.string(),
	z
		.object({
			input: z.string(),
			description: z.string().optional(),
		})
		.passthrough(),
]);

export const a2aSkillSchema = z
	.object({
		id: z.string().optional().describe("Unique identifier for the skill"),
		name: z.string().min(1, "Skill name cannot be empty"),
		description: z.string().default("").describe("Detailed description of what the skill does"),
		tags: z
			.array(z.string())
			.default([])
			.describe("Semantic tags for search and categorization"),
		examples: z
			.array(a2aSkillExampleSchema)
			.default([])
			.describe("Example natural-language prompts illustrating skill invocation"),
		inputModes: z
			.array(z.string())
			.optional()
			.describe("Accepted MIME media types specific to this skill"),
		outputModes: z
			.array(z.string())
			.optional()
			.describe("Returned MIME media types specific to this skill"),
	})
	.passthrough();

// Discriminated union for security schemes
export const a2aApiKeySecuritySchemeSchema = z
	.object({
		type: z.literal("apiKey"),
		name: z.string().min(1, "apiKey security scheme requires a parameter name"),
		in: z.enum(["header", "query", "cookie"], {
			message: "apiKey 'in' location must be 'header', 'query', or 'cookie'",
		}),
		description: z.string().optional(),
	})
	.passthrough();

export const a2aHttpSecuritySchemeSchema = z
	.object({
		type: z.literal("http"),
		scheme: z.string().min(1, "http security scheme requires a scheme (e.g. bearer, basic)"),
		bearerFormat: z.string().optional().describe("Bearer token format (e.g. JWT)"),
		description: z.string().optional(),
	})
	.passthrough();

export const a2aOAuth2SecuritySchemeSchema = z
	.object({
		type: z.literal("oauth2"),
		flows: z.record(z.string(), z.unknown()).describe("OAuth2 flow definitions"),
		description: z.string().optional(),
	})
	.passthrough();

export const a2aOpenIdConnectSecuritySchemeSchema = z
	.object({
		type: z.literal("openIdConnect"),
		openIdConnectUrl: z
			.string()
			.min(1, "openIdConnect security scheme requires openIdConnectUrl"),
		description: z.string().optional(),
	})
	.passthrough();

export const a2aMutualTlsSecuritySchemeSchema = z
	.object({
		type: z.literal("mutualTLS"),
		description: z.string().optional(),
	})
	.passthrough();

export const a2aSecuritySchemeSchema = z.discriminatedUnion("type", [
	a2aApiKeySecuritySchemeSchema,
	a2aHttpSecuritySchemeSchema,
	a2aOAuth2SecuritySchemeSchema,
	a2aOpenIdConnectSecuritySchemeSchema,
	a2aMutualTlsSecuritySchemeSchema,
]);

export const a2aSignatureSchema = z
	.object({
		protected: z.string().min(1, "JWS protected header must be a non-empty string"),
		signature: z.string().min(1, "JWS signature must be a non-empty string"),
		header: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough();

// Official A2A v1.0 AgentCard Schema
export const a2aV1AgentCardSchema = z
	.object({
		name: z.string().min(1, "Name cannot be empty"),
		description: z
			.string()
			.default("")
			.describe("High-level summary of the agent scope and capabilities"),
		version: z
			.string()
			.optional()
			.describe("Software release version of the agent implementation"),
		supportedInterfaces: z
			.array(a2aV1SupportedInterfaceSchema)
			.min(1, "A2A v1.0 requires at least one supported interface in 'supportedInterfaces'"),
		provider: a2aV1ProviderSchema.optional().describe("Author or publisher metadata"),
		capabilities: a2aCapabilitiesSchema
			.optional()
			.describe("Protocol capability feature flags"),
		defaultInputModes: z
			.array(z.string())
			.optional()
			.describe("Accepted MIME media types for inbound task messages"),
		defaultOutputModes: z
			.array(z.string())
			.optional()
			.describe("Produced MIME media types for outbound responses"),
		skills: z
			.array(a2aSkillSchema)
			.optional()
			.default([])
			.describe("Discrete functional capabilities offered by the agent"),
		securitySchemes: z
			.record(z.string(), a2aSecuritySchemeSchema)
			.optional()
			.describe("Declared security schemes required to authenticate with the agent"),
		securityRequirements: z
			.array(z.record(z.string(), z.array(z.string())))
			.optional()
			.describe("Active security requirements mapping scheme names to required scopes"),
		signatures: z
			.array(a2aSignatureSchema)
			.optional()
			.describe("Cryptographic JWS signatures for AgentCard integrity and authenticity"),
		iconUrl: z.string().optional().describe("URL reference to an avatar or icon image"),
		documentationUrl: z.string().optional().describe("URL reference to public documentation"),
	})
	.passthrough()
	.superRefine((data, ctx) => {
		const raw = data as Record<string, unknown>;
		// In v1.0, top-level protocolVersion is removed in favor of nested supportedInterfaces[].protocolVersion
		if ("protocolVersion" in raw) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Invalid A2A v1.0 card: top-level 'protocolVersion' was removed in v1.0. Specify 'protocolVersion' inside each entry in 'supportedInterfaces'.",
				path: ["protocolVersion"],
			});
		}
		// In v1.0, top-level url was replaced by supportedInterfaces[].url
		if ("url" in raw) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Invalid A2A v1.0 card: top-level 'url' was replaced by 'supportedInterfaces' in v1.0.",
				path: ["url"],
			});
		}
		// In v1.0, agentVersion is not a valid field (use version)
		if ("agentVersion" in raw) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Invalid A2A v1.0 card: 'agentVersion' is a legacy v0.3 field. Use 'version' in v1.0.",
				path: ["agentVersion"],
			});
		}
		// Legacy schemaVersion declaration
		if ("schemaVersion" in raw && raw.schemaVersion === "0.3") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Invalid A2A v1.0 card: conflicting legacy 'schemaVersion: 0.3' declared alongside v1.0 fields.",
				path: ["schemaVersion"],
			});
		}
	});

// Legacy A2A v0.3 AgentCard Schema
export const a2aLegacyV03AgentCardSchema = z
	.object({
		name: z.string().min(1, "Name cannot be empty"),
		description: z
			.string()
			.default("")
			.describe("High-level summary of the agent scope and capabilities"),
		version: z.string().optional().describe("Agent release version"),
		agentVersion: z.string().optional().describe("Legacy agent release version key"),
		schemaVersion: z.string().optional().describe("Legacy format version key"),
		protocolVersion: z.string().optional().describe("Legacy protocol version key"),
		url: z.string().optional().describe("Legacy v0.3 primary endpoint URL"),
		provider: a2aLegacyV03ProviderSchema.optional().describe("Legacy provider metadata"),
		capabilities: a2aCapabilitiesSchema.optional(),
		defaultInputModes: z.array(z.string()).optional(),
		defaultOutputModes: z.array(z.string()).optional(),
		skills: z.array(a2aSkillSchema).optional().default([]),
		securitySchemes: z.record(z.string(), z.unknown()).optional(),
		security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
		securityRequirements: z.array(z.record(z.string(), z.array(z.string()))).optional(),
		iconUrl: z.string().optional(),
		documentationUrl: z.string().optional(),
	})
	.passthrough()
	.superRefine((data, ctx) => {
		const raw = data as Record<string, unknown>;
		if ("supportedInterfaces" in raw) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Invalid legacy v0.3 card: 'supportedInterfaces' is an A2A v1.0 field and cannot be used in a legacy v0.3 card.",
				path: ["supportedInterfaces"],
			});
		}
		if ("signatures" in raw) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Invalid legacy v0.3 card: 'signatures' is an A2A v1.0 field and cannot be used in a legacy v0.3 card.",
				path: ["signatures"],
			});
		}
	});

export type A2ASpecVersion = "v1.0" | "v0.3";

export function detectA2aCardVersion(raw: unknown): A2ASpecVersion {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		throw new Error("A2A Agent Card must be a non-null JSON object.");
	}
	const obj = raw as Record<string, unknown>;

	const hasSupportedInterfaces = "supportedInterfaces" in obj;
	const hasLegacyUrl = "url" in obj;
	const hasLegacyAgentVersion = "agentVersion" in obj;
	const hasLegacySchemaVersion = obj.schemaVersion === "0.3";
	const hasTopLevelProtocolVersion = "protocolVersion" in obj;

	// Cross-version conflict: v1.0 supportedInterfaces mixed with legacy-only fields
	if (
		hasSupportedInterfaces &&
		(hasLegacyUrl ||
			hasLegacyAgentVersion ||
			hasLegacySchemaVersion ||
			hasTopLevelProtocolVersion)
	) {
		// Route to v1 schema so it fails with specific cross-version error
		return "v1.0";
	}

	// Explicit legacy markers
	if (
		hasLegacySchemaVersion ||
		hasLegacyAgentVersion ||
		(hasLegacyUrl && !hasSupportedInterfaces)
	) {
		return "v0.3";
	}

	// Default to v1.0
	return "v1.0";
}

export function parseA2aAgentCard(raw: unknown): A2AAgentCard {
	const version = detectA2aCardVersion(raw);
	if (version === "v1.0") {
		const parsed = a2aV1AgentCardSchema.parse(raw) as A2AV1AgentCard;
		parsed.specVersion = "v1.0";
		return parsed;
	} else {
		const parsed = a2aLegacyV03AgentCardSchema.parse(raw) as A2ALegacyV03AgentCard;
		parsed.specVersion = "v0.3";
		return parsed;
	}
}

// Unified Zod schema for A2A Agent Card validation
export const a2aAgentCardSchema = z.custom<A2AAgentCard>(
	(data) => {
		try {
			parseA2aAgentCard(data);
			return true;
		} catch {
			return false;
		}
	},
	{ message: "Invalid A2A Agent Card" },
);

// Helper safe parser that preserves exact Zod issues
export function safeParseA2aAgentCard(
	raw: unknown,
): { success: true; data: A2AAgentCard } | { success: false; error: z.ZodError } {
	try {
		const version = detectA2aCardVersion(raw);
		if (version === "v1.0") {
			const res = a2aV1AgentCardSchema.safeParse(raw);
			if (!res.success) return res;
			const card = res.data as A2AV1AgentCard;
			card.specVersion = "v1.0";
			return { success: true, data: card };
		} else {
			const res = a2aLegacyV03AgentCardSchema.safeParse(raw);
			if (!res.success) return res;
			const card = res.data as A2ALegacyV03AgentCard;
			card.specVersion = "v0.3";
			return { success: true, data: card };
		}
	} catch (err: unknown) {
		const zodErr = new z.ZodError([
			{
				code: z.ZodIssueCode.custom,
				message: err instanceof Error ? err.message : String(err),
				path: [],
			},
		]);
		return { success: false, error: zodErr };
	}
}
