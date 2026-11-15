import { z } from "zod";

export const trustStatusSchema = z.enum(["declared", "verified", "observed"]);
export type TrustStatus = z.infer<typeof trustStatusSchema>;

export const agentSourceTypeSchema = z.enum(["mcp-registry", "a2a", "github", "custom", "manual"]);
export type AgentSourceType = z.infer<typeof agentSourceTypeSchema>;

export const httpUrlSchema = z
	.string()
	.url()
	.refine(
		(val) => {
			try {
				const parsed = new URL(val);
				return parsed.protocol === "http:" || parsed.protocol === "https:";
			} catch {
				return false;
			}
		},
		{ message: "URL must use http or https protocol" },
	);

export const agentSourceSchema = z.object({
	type: agentSourceTypeSchema.describe("Ecosystem or source catalog identifier"),
	name: z.string().min(1).describe("Human-readable name of the source"),
	url: httpUrlSchema.optional().describe("URL reference to the source repository or catalog"),
	identifier: z.string().min(1).describe("Original source identifier or package name"),
});
export type AgentSource = z.infer<typeof agentSourceSchema>;

export const agentClassificationSchema = z.object({
	capabilities: z
		.array(z.string())
		.default([])
		.describe("Functional capabilities provided by the agent"),
	skills: z
		.array(z.string())
		.default([])
		.describe("Specific discrete tasks or skills the agent can perform"),
	categories: z.array(z.string()).default([]).describe("High-level taxonomy categories"),
	tags: z.array(z.string()).default([]).describe("Searchable keywords or labels"),
});
export type AgentClassification = z.infer<typeof agentClassificationSchema>;

export const agentCommunicationSchema = z.object({
	protocols: z
		.array(z.string())
		.min(1)
		.default(["mcp"])
		.describe("Supported transport protocols (e.g. streamable-http, sse, stdio, a2a)"),
	framework: z.string().optional().describe("Underlying agent framework if applicable"),
	endpoint: httpUrlSchema.optional().describe("Publicly reachable endpoint URL if declared"),
});
export type AgentCommunication = z.infer<typeof agentCommunicationSchema>;

export const agentAuthenticationSchema = z.object({
	required: z
		.boolean()
		.default(false)
		.describe("Whether authentication is required to access the agent"),
	declaredMethods: z
		.array(z.string())
		.default([])
		.describe(
			"Declared authentication types (e.g. none, bearer, oauth2, api-key). Never stores secrets",
		),
});
export type AgentAuthentication = z.infer<typeof agentAuthenticationSchema>;

export const agentIOSchema = z.object({
	supportedInputs: z
		.array(z.string())
		.default(["text"])
		.describe("MIME or data types accepted as input"),
	supportedOutputs: z
		.array(z.string())
		.default(["text"])
		.describe("MIME or data types returned as output"),
});
export type AgentIO = z.infer<typeof agentIOSchema>;

export const agentMetadataSchema = z.object({
	version: z.string().default("0.1.0").describe("Semver or version string"),
	provider: z.string().optional().describe("Author, publisher or organization name"),
	lastUpdated: z.string().optional().describe("ISO timestamp when the source was last modified"),
	discoveryTimestamp: z
		.string()
		.describe("ISO timestamp when this profile was discovered or ingested"),
	documentationUrl: httpUrlSchema.optional().describe("Documentation or specification URL"),
	iconUrl: httpUrlSchema.optional().describe("Icon or avatar image URL"),
	a2a: z.record(z.string(), z.unknown()).optional().describe("Protocol-specific A2A metadata"),
	extra: z.record(z.string(), z.unknown()).optional().describe("Arbitrary extension metadata"),
});
export type AgentMetadata = z.infer<typeof agentMetadataSchema>;

export const agentTrustSchema = z.object({
	status: trustStatusSchema
		.default("declared")
		.describe("Trust evaluation status: declared, verified, or observed"),
	notes: z.string().optional().describe("Context or justification regarding verification status"),
});
export type AgentTrust = z.infer<typeof agentTrustSchema>;

export const agentProfileSchema = z.object({
	id: z
		.string()
		.min(1)
		.describe("Unique universal identifier (e.g. mcp-registry:io.example/server@1.0.0)"),
	name: z.string().min(1).describe("Human-readable agent or server name"),
	description: z
		.string()
		.default("")
		.describe("Detailed overview of the agent purpose and capabilities"),
	source: agentSourceSchema,
	classification: agentClassificationSchema,
	communication: agentCommunicationSchema,
	authentication: agentAuthenticationSchema,
	io: agentIOSchema,
	metadata: agentMetadataSchema,
	trust: agentTrustSchema,
});
export type AgentProfile = z.infer<typeof agentProfileSchema>;
