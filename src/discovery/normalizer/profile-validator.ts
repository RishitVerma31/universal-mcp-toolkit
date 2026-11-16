import type { AgentProfile } from "../types/agent-profile.ts";
import { agentProfileSchema } from "../types/agent-profile.ts";

export interface ProfileValidationResult {
	valid: boolean;
	normalizedProfile: AgentProfile | null;
	missingOptionalFields: string[];
	validationErrors: string[];
	unknownProperties: string[];
}

const KNOWN_TOP_LEVEL_KEYS = new Set([
	"id",
	"name",
	"description",
	"source",
	"classification",
	"communication",
	"authentication",
	"io",
	"metadata",
	"trust",
]);

function sanitizeString(val: unknown, maxLength = 1000): string | undefined {
	if (typeof val !== "string") return undefined;
	const trimmed = val.trim();
	return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

function sanitizeHttpUrl(val: unknown): string | undefined {
	if (typeof val !== "string") return undefined;
	try {
		const parsed = new URL(val.trim());
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

function sanitizeStringArray(val: unknown, maxItems = 100, maxItemLength = 200): string[] {
	if (!Array.isArray(val)) return [];
	return val
		.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
		.map((item) => item.trim().slice(0, maxItemLength))
		.slice(0, maxItems);
}

export function validateAndNormalizeProfile(
	input: Record<string, unknown>,
	shouldNormalize = true,
): ProfileValidationResult {
	const validationErrors: string[] = [];
	const missingOptionalFields: string[] = [];
	const unknownProperties = Object.keys(input).filter((k) => !KNOWN_TOP_LEVEL_KEYS.has(k));

	let candidate = { ...input };

	if (shouldNormalize) {
		const rawName = sanitizeString(candidate.name, 200) || "unnamed-agent";
		const rawId =
			sanitizeString(candidate.id, 200) ||
			`manual:${rawName.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`;

		const rawSource =
			typeof candidate.source === "object" && candidate.source !== null
				? (candidate.source as Record<string, unknown>)
				: {};

		const rawClassification =
			typeof candidate.classification === "object" && candidate.classification !== null
				? (candidate.classification as Record<string, unknown>)
				: {};

		const rawCommunication =
			typeof candidate.communication === "object" && candidate.communication !== null
				? (candidate.communication as Record<string, unknown>)
				: {};

		const rawAuth =
			typeof candidate.authentication === "object" && candidate.authentication !== null
				? (candidate.authentication as Record<string, unknown>)
				: {};

		const rawIO =
			typeof candidate.io === "object" && candidate.io !== null
				? (candidate.io as Record<string, unknown>)
				: {};

		const rawMetadata =
			typeof candidate.metadata === "object" && candidate.metadata !== null
				? (candidate.metadata as Record<string, unknown>)
				: {};

		const rawTrust =
			typeof candidate.trust === "object" && candidate.trust !== null
				? (candidate.trust as Record<string, unknown>)
				: {};

		const rawCategories = sanitizeStringArray(rawClassification.categories);
		const rawProtocols = sanitizeStringArray(rawCommunication.protocols);
		const rawMethods = sanitizeStringArray(rawAuth.declaredMethods);
		const rawInputs = sanitizeStringArray(rawIO.supportedInputs);
		const rawOutputs = sanitizeStringArray(rawIO.supportedOutputs);

		candidate = {
			id: rawId,
			name: rawName,
			description: sanitizeString(candidate.description, 2000) || "",
			source: {
				type:
					typeof rawSource.type === "string" &&
					["mcp-registry", "a2a", "github", "custom", "manual"].includes(rawSource.type)
						? rawSource.type
						: "manual",
				name: sanitizeString(rawSource.name, 200) || "Manual Entry",
				url: sanitizeHttpUrl(rawSource.url),
				identifier: sanitizeString(rawSource.identifier, 200) || rawId,
			},
			classification: {
				capabilities: sanitizeStringArray(rawClassification.capabilities),
				skills: sanitizeStringArray(rawClassification.skills),
				categories: rawCategories.length > 0 ? rawCategories : ["general"],
				tags: sanitizeStringArray(rawClassification.tags),
			},
			communication: {
				protocols: rawProtocols,
				framework: sanitizeString(rawCommunication.framework, 100),
				endpoint: sanitizeHttpUrl(rawCommunication.endpoint),
			},
			authentication: {
				required: typeof rawAuth.required === "boolean" ? rawAuth.required : false,
				declaredMethods: rawMethods,
			},
			io: {
				supportedInputs: rawInputs.length > 0 ? rawInputs : ["text"],
				supportedOutputs: rawOutputs.length > 0 ? rawOutputs : ["text"],
			},
			metadata: {
				version: sanitizeString(rawMetadata.version, 50) || undefined,
				provider: sanitizeString(rawMetadata.provider, 200),
				lastUpdated: sanitizeString(rawMetadata.lastUpdated, 100),
				discoveryTimestamp:
					sanitizeString(rawMetadata.discoveryTimestamp, 100) || new Date().toISOString(),
			},
			trust: {
				status:
					typeof rawTrust.status === "string" &&
					["declared", "verified", "observed"].includes(rawTrust.status)
						? rawTrust.status
						: "declared",
				notes:
					sanitizeString(rawTrust.notes, 500) ||
					"Manually supplied agent profile (unverified).",
			},
		};
	}

	const parseResult = agentProfileSchema.safeParse(candidate);

	if (!parseResult.success) {
		for (const issue of parseResult.error.issues) {
			validationErrors.push(`${issue.path.join(".") || "root"}: ${issue.message}`);
		}
		return {
			valid: false,
			normalizedProfile: null,
			missingOptionalFields: [],
			validationErrors,
			unknownProperties,
		};
	}

	const profile = parseResult.data;

	// Detect missing optional fields
	if (!profile.communication.endpoint) missingOptionalFields.push("communication.endpoint");
	if (!profile.communication.framework) missingOptionalFields.push("communication.framework");
	if (!profile.metadata.provider) missingOptionalFields.push("metadata.provider");
	if (!profile.metadata.lastUpdated) missingOptionalFields.push("metadata.lastUpdated");
	if (!profile.source.url) missingOptionalFields.push("source.url");
	if (profile.classification.skills.length === 0)
		missingOptionalFields.push("classification.skills");
	if (profile.classification.tags.length === 0) missingOptionalFields.push("classification.tags");

	return {
		valid: true,
		normalizedProfile: profile,
		missingOptionalFields,
		validationErrors: [],
		unknownProperties,
	};
}
