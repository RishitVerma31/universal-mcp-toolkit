import type {
	DetailOptions,
	DiscoveryConnector,
	DiscoveryQuery,
	DiscoveryResult,
} from "../../types/connector.ts";
import type { AgentProfile } from "../../types/agent-profile.ts";
import { McpRegistryClient } from "./client.ts";
import type { McpRegistryClientOptions } from "./client.ts";
import { normalizeMcpRegistryServer } from "../../normalizer/mcp-registry-normalizer.ts";
import { deduplicateProfiles } from "../../deduplication/deduplicator.ts";

export class McpRegistryConnector implements DiscoveryConnector {
	readonly id = "mcp-registry";
	readonly name = "Official Model Context Protocol Registry";
	private readonly client: McpRegistryClient;

	constructor(clientOrOptions?: McpRegistryClient | McpRegistryClientOptions) {
		if (clientOrOptions instanceof McpRegistryClient) {
			this.client = clientOrOptions;
		} else {
			this.client = new McpRegistryClient(clientOrOptions);
		}
	}

	async search(query: DiscoveryQuery): Promise<DiscoveryResult> {
		const raw = await this.client.listServers({
			search: query.query,
			limit: query.limit,
			cursor: query.cursor,
			version: query.latestOnly !== false ? "latest" : undefined,
		});

		const rawProfiles: AgentProfile[] = [];
		for (const entry of raw.servers || []) {
			try {
				if (entry && entry.server && typeof entry.server.name === "string") {
					rawProfiles.push(normalizeMcpRegistryServer(entry));
				}
			} catch {
				// Isolate individual malformed upstream records to prevent search failure
			}
		}

		const profiles = deduplicateProfiles(rawProfiles);

		return {
			profiles,
			totalCount: raw.metadata?.count ?? profiles.length,
			nextCursor: raw.metadata?.nextCursor ?? null,
			source: "https://registry.modelcontextprotocol.io",
		};
	}

	async getDetails(
		identifier: string,
		options: DetailOptions = {},
	): Promise<AgentProfile | null> {
		const raw = await this.client.getServerVersion(identifier, options.version || "latest");
		if (!raw || !raw.server || typeof raw.server.name !== "string") {
			return null;
		}

		try {
			return normalizeMcpRegistryServer(raw);
		} catch {
			return null;
		}
	}
}
