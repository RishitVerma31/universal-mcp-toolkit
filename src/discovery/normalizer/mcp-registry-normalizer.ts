import type { AgentProfile } from "../types/agent-profile.ts";
import { agentProfileSchema } from "../types/agent-profile.ts";
import type { McpRegistryServerEntry } from "../connectors/mcp-registry/types.ts";

function isValidUrl(urlString?: string): string | undefined {
	if (!urlString) return undefined;
	try {
		const parsed = new URL(urlString);
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

export function normalizeMcpRegistryServer(entry: McpRegistryServerEntry): AgentProfile {
	const server = entry.server;
	const meta = entry["_meta"]?.["io.modelcontextprotocol.registry/official"];

	// Extract communication protocols and endpoint
	const protocols = new Set<string>(["mcp"]);
	let primaryEndpoint: string | undefined = undefined;

	if (Array.isArray(server.remotes) && server.remotes.length > 0) {
		for (const remote of server.remotes) {
			if (remote.type) protocols.add(remote.type);
			if (!primaryEndpoint && remote.url) {
				primaryEndpoint = isValidUrl(remote.url);
			}
		}
	}

	if (Array.isArray(server.packages) && server.packages.length > 0) {
		protocols.add("stdio");
	}

	// Extract capabilities without fabricating unsupported skills
	const capabilities = new Set<string>(["mcp:server"]);
	if (server.remotes && server.remotes.length > 0) {
		capabilities.add("remote-mcp");
	}
	if (server.packages && server.packages.length > 0) {
		capabilities.add("package-installable");
	}

	// Tags
	const tags = new Set<string>();
	if (server.repository?.source) {
		tags.add(`source:${server.repository.source}`);
	}
	if (server.packages) {
		for (const pkg of server.packages) {
			if (pkg.registry) tags.add(`registry:${pkg.registry}`);
		}
	}

	const provider = server.name.includes("/") ? server.name.split("/")[0] : undefined;

	const sourceUrl =
		isValidUrl(server.repository?.url) ?? "https://registry.modelcontextprotocol.io";

	const profile: AgentProfile = {
		id: `mcp-registry:${server.name}@${server.version || "latest"}`,
		name: server.title || server.name,
		description: server.description || "",
		source: {
			type: "mcp-registry",
			name: "Model Context Protocol Registry",
			url: sourceUrl,
			identifier: server.name,
		},
		classification: {
			capabilities: Array.from(capabilities),
			skills: [],
			categories: ["mcp-server"],
			tags: Array.from(tags),
		},
		communication: {
			protocols: Array.from(protocols),
			framework: "modelcontextprotocol",
			endpoint: primaryEndpoint,
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
			version: server.version || "0.1.0",
			provider,
			lastUpdated: meta?.updatedAt || meta?.publishedAt,
			discoveryTimestamp: new Date().toISOString(),
		},
		trust: {
			status: "declared",
			notes: "Discovered via official MCP Registry API (unverified declared metadata).",
		},
	};

	return agentProfileSchema.parse(profile);
}
