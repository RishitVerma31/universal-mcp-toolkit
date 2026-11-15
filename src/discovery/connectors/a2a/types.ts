export interface A2ASupportedInterface {
	url: string;
	protocolBinding: string;
	protocolVersion: string;
	tenant?: string;
}

export interface A2AV1Provider {
	organization: string;
	url?: string;
	supportContact?: string;
}

export interface A2ALegacyProvider {
	name?: string;
	organization?: string;
	url?: string;
	supportContact?: string;
}

export type A2AProvider = A2AV1Provider | A2ALegacyProvider;

export interface A2ACardSignature {
	protected: string;
	signature: string;
	header?: Record<string, unknown>;
}

export interface A2ACapabilities {
	streaming?: boolean;
	pushNotifications?: boolean;
	extendedAgentCard?: boolean;
	a2aVersion?: string;
	supportedMessageParts?: string[];
	[key: string]: unknown;
}

export interface A2ASkillExampleObject {
	input: string;
	description?: string;
}

export type A2ASkillExample = string | A2ASkillExampleObject;

export interface A2ASkill {
	id?: string;
	name: string;
	description?: string;
	tags?: string[];
	examples?: A2ASkillExample[];
	inputModes?: string[];
	outputModes?: string[];
	[key: string]: unknown;
}

export interface A2AApiKeySecurityScheme {
	type: "apiKey";
	name: string;
	in: "header" | "query" | "cookie";
	description?: string;
}

export interface A2AHttpSecurityScheme {
	type: "http";
	scheme: string;
	bearerFormat?: string;
	description?: string;
}

export interface A2AOAuth2SecurityScheme {
	type: "oauth2";
	flows: Record<string, unknown>;
	description?: string;
}

export interface A2AOpenIdConnectSecurityScheme {
	type: "openIdConnect";
	openIdConnectUrl: string;
	description?: string;
}

export interface A2AMutualTlsSecurityScheme {
	type: "mutualTLS";
	description?: string;
}

export type A2ASecurityScheme =
	| A2AApiKeySecurityScheme
	| A2AHttpSecurityScheme
	| A2AOAuth2SecurityScheme
	| A2AOpenIdConnectSecurityScheme
	| A2AMutualTlsSecurityScheme;

export type A2ASecurityRequirement = Record<string, string[]>;

export interface A2AV1AgentCard {
	specVersion?: "v1.0";
	name: string;
	description?: string;
	version?: string;
	agentVersion?: string;
	protocolVersion?: string;
	schemaVersion?: string;
	url?: string;
	supportedInterfaces: A2ASupportedInterface[];
	provider?: A2AV1Provider;
	capabilities?: A2ACapabilities;
	defaultInputModes?: string[];
	defaultOutputModes?: string[];
	skills?: A2ASkill[];
	securitySchemes?: Record<string, A2ASecurityScheme>;
	securityRequirements?: A2ASecurityRequirement[];
	signatures?: A2ACardSignature[];
	iconUrl?: string;
	documentationUrl?: string;
	[key: string]: unknown;
}

export interface A2ALegacyV03AgentCard {
	specVersion?: "v0.3";
	name: string;
	description?: string;
	version?: string;
	agentVersion?: string;
	schemaVersion?: string;
	protocolVersion?: string;
	url?: string;
	supportedInterfaces?: A2ASupportedInterface[];
	provider?: A2ALegacyProvider;
	capabilities?: A2ACapabilities;
	defaultInputModes?: string[];
	defaultOutputModes?: string[];
	skills?: A2ASkill[];
	securitySchemes?: Record<string, unknown>;
	security?: A2ASecurityRequirement[];
	securityRequirements?: A2ASecurityRequirement[];
	signatures?: A2ACardSignature[];
	iconUrl?: string;
	documentationUrl?: string;
	[key: string]: unknown;
}

export type A2AAgentCard = A2AV1AgentCard | A2ALegacyV03AgentCard;

export interface A2ADiscoveryResult {
	agentCardUrl: string;
	card: A2AAgentCard;
	resolvedBaseUrl: string;
}
