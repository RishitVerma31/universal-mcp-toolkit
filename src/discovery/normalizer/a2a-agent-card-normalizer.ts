import type { AgentProfile } from "../types/agent-profile.ts";
import { agentProfileSchema } from "../types/agent-profile.ts";
import type { A2AAgentCard } from "../connectors/a2a/types.ts";

function isValidHttpUrl(urlString?: string): string | undefined {
	if (!urlString || typeof urlString !== "string") return undefined;
	try {
		const parsed = new URL(urlString.trim());
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

export function normalizeA2aAgentCard(card: A2AAgentCard, discoveryUrl: string): AgentProfile {
	const version = card.version || card.agentVersion || "0.1.0";
	let host = "unknown-host";
	try {
		host = new URL(discoveryUrl).hostname;
	} catch {
		// fallback
	}

	const sanitizedCardName = card.name.trim();
	const profileId = `a2a:${host}/${encodeURIComponent(sanitizedCardName)}@${version}`;

	// Capabilities extraction
	const capabilities = new Set<string>(["a2a:agent"]);
	if (card.capabilities?.streaming) {
		capabilities.add("streaming");
	}
	if (card.capabilities?.pushNotifications) {
		capabilities.add("push-notifications");
	}
	if (card.capabilities?.extendedAgentCard) {
		capabilities.add("extended-agent-card");
	}
	if (card.capabilities?.a2aVersion) {
		capabilities.add(`a2a-v${card.capabilities.a2aVersion}`);
	}
	if (card.capabilities && typeof card.capabilities === "object") {
		for (const [key, val] of Object.entries(card.capabilities)) {
			if (val === true) {
				capabilities.add(key);
			}
		}
	}

	// Skills extraction
	const skills: string[] = [];
	const tags = new Set<string>();

	if (Array.isArray(card.skills)) {
		for (const skill of card.skills) {
			if (skill.name) {
				skills.push(skill.name.trim());
			} else if (skill.id) {
				skills.push(skill.id.trim());
			}

			if (Array.isArray(skill.tags)) {
				for (const tag of skill.tags) {
					if (typeof tag === "string" && tag.trim().length > 0) {
						tags.add(tag.trim());
					}
				}
			}
		}
	}

	// Communication interfaces
	const protocols = new Set<string>(["a2a"]);
	let primaryEndpoint: string | undefined = undefined;

	if (Array.isArray(card.supportedInterfaces) && card.supportedInterfaces.length > 0) {
		for (const iface of card.supportedInterfaces) {
			if (iface.protocolBinding) {
				protocols.add(iface.protocolBinding.toLowerCase());
			}
			if (!primaryEndpoint && iface.url) {
				primaryEndpoint = isValidHttpUrl(iface.url);
			}
		}
	}

	// Legacy v0.3 url fallback
	if (!primaryEndpoint && card.url) {
		primaryEndpoint = isValidHttpUrl(card.url);
	}

	// If no interface URL was given, default to the discovery origin
	if (!primaryEndpoint) {
		primaryEndpoint = isValidHttpUrl(discoveryUrl);
	}

	// Authentication mapping
	const secReqs = card.securityRequirements || card.security || [];
	const authRequired = Array.isArray(secReqs) && secReqs.length > 0;

	const declaredMethods = new Set<string>();
	if (card.securitySchemes && typeof card.securitySchemes === "object") {
		for (const [schemeKey, schemeObj] of Object.entries(card.securitySchemes)) {
			if (
				schemeObj &&
				typeof schemeObj === "object" &&
				"type" in schemeObj &&
				typeof schemeObj.type === "string"
			) {
				declaredMethods.add(schemeObj.type);
			} else {
				declaredMethods.add(schemeKey);
			}
		}
	}

	if (authRequired && declaredMethods.size === 0) {
		declaredMethods.add("custom");
	} else if (!authRequired && declaredMethods.size === 0) {
		declaredMethods.add("none");
	}

	// I/O Modalities
	const supportedInputs =
		Array.isArray(card.defaultInputModes) && card.defaultInputModes.length > 0
			? card.defaultInputModes
			: ["text/plain", "application/json"];

	const supportedOutputs =
		Array.isArray(card.defaultOutputModes) && card.defaultOutputModes.length > 0
			? card.defaultOutputModes
			: ["application/json"];

	// Provider & URLs
	const providerName =
		(card.provider as any)?.organization || (card.provider as any)?.name || card.name;
	const sourceUrl = isValidHttpUrl(card.provider?.url) || discoveryUrl;
	const documentationUrl = isValidHttpUrl(card.documentationUrl);
	const iconUrl = isValidHttpUrl(card.iconUrl);

	// A2A-specific metadata preservation
	const hasSignatures = Array.isArray(card.signatures) && card.signatures.length > 0;
	const a2aMetadata: Record<string, unknown> = {
		specVersion: card.specVersion || (card.supportedInterfaces ? "v1.0" : "v0.3"),
		protocolVersion:
			card.supportedInterfaces?.[0]?.protocolVersion ||
			(card as any).protocolVersion ||
			(card as any).schemaVersion ||
			"1.0",
		supportedInterfaces: card.supportedInterfaces || [],
		capabilities: card.capabilities || {},
		securitySchemes: card.securitySchemes || {},
		securityRequirements: secReqs,
		...(hasSignatures
			? {
					signatures: {
						count: card.signatures!.length,
						verified: false,
						status: "unverified",
						note: "Cryptographic signature verification is not performed in this milestone. Signatures are preserved as unverified declared metadata.",
						declarations: card.signatures!.map((sig) => ({
							protected: sig.protected,
							signature: sig.signature,
							header: sig.header,
						})),
					},
				}
			: {}),
	};

	// Collect custom/unknown extension properties into metadata.extra
	const knownCardKeys = new Set([
		"name",
		"description",
		"version",
		"agentVersion",
		"protocolVersion",
		"schemaVersion",
		"url",
		"supportedInterfaces",
		"provider",
		"capabilities",
		"defaultInputModes",
		"defaultOutputModes",
		"skills",
		"securitySchemes",
		"security",
		"securityRequirements",
		"signatures",
		"specVersion",
		"iconUrl",
		"documentationUrl",
	]);

	const extra: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(card)) {
		if (!knownCardKeys.has(key)) {
			extra[key] = val;
		}
	}

	const profile: AgentProfile = {
		id: profileId,
		name: sanitizedCardName,
		description: card.description || "",
		source: {
			type: "a2a",
			name: providerName,
			url: sourceUrl,
			identifier: sanitizedCardName,
		},
		classification: {
			capabilities: Array.from(capabilities),
			skills,
			categories: ["agent", "a2a", "a2a-agent"],
			tags: Array.from(tags),
		},
		communication: {
			protocols: Array.from(protocols),
			framework: "a2a",
			endpoint: primaryEndpoint,
		},
		authentication: {
			required: authRequired,
			declaredMethods: Array.from(declaredMethods),
		},
		io: {
			supportedInputs,
			supportedOutputs,
		},
		metadata: {
			version,
			provider: (card.provider as any)?.organization || (card.provider as any)?.name,
			discoveryTimestamp: new Date().toISOString(),
			documentationUrl,
			iconUrl,
			a2a: a2aMetadata,
			...(Object.keys(extra).length > 0 ? { extra } : {}),
		},
		trust: {
			status: "declared",
			notes: hasSignatures
				? `Discovered via A2A Agent Card at ${discoveryUrl} (unverified declared metadata; ${card.signatures!.length} unverified signature(s) present).`
				: `Discovered via A2A Agent Card at ${discoveryUrl} (unverified declared metadata).`,
		},
	};

	return agentProfileSchema.parse(profile);
}
