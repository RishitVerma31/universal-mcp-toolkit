import type {
	DetailOptions,
	DiscoveryConnector,
	DiscoveryQuery,
	DiscoveryResult,
} from "../types/connector.ts";
import type { AgentProfile } from "../types/agent-profile.ts";
import { McpRegistryConnector } from "../connectors/mcp-registry/connector.ts";
import { deduplicateProfiles } from "../deduplication/deduplicator.ts";

export class DiscoveryEngine {
	private readonly connectors = new Map<string, DiscoveryConnector>();

	constructor(initialConnectors?: DiscoveryConnector[]) {
		if (initialConnectors && initialConnectors.length > 0) {
			for (const c of initialConnectors) {
				this.registerConnector(c);
			}
		} else {
			// Register default MCP Registry connector
			this.registerConnector(new McpRegistryConnector());
		}
	}

	registerConnector(connector: DiscoveryConnector): void {
		this.connectors.set(connector.id, connector);
	}

	getConnector(id: string): DiscoveryConnector | undefined {
		return this.connectors.get(id);
	}

	listConnectors(): Array<{ id: string; name: string }> {
		return Array.from(this.connectors.values()).map((c) => ({
			id: c.id,
			name: c.name,
		}));
	}

	async search(query: DiscoveryQuery, targetConnectorId?: string): Promise<DiscoveryResult> {
		if (targetConnectorId) {
			const connector = this.connectors.get(targetConnectorId);
			if (!connector) {
				throw new Error(`Discovery connector '${targetConnectorId}' not found.`);
			}
			return connector.search(query);
		}

		// When searching across all connectors, execute safely without letting one failure crash all
		const results = await Promise.allSettled(
			Array.from(this.connectors.values()).map((connector) => connector.search(query)),
		);

		const allProfiles: AgentProfile[] = [];
		let total = 0;
		const sources: string[] = [];

		for (const res of results) {
			if (res.status === "fulfilled") {
				allProfiles.push(...res.value.profiles);
				total += res.value.totalCount ?? res.value.profiles.length;
				if (!sources.includes(res.value.source)) {
					sources.push(res.value.source);
				}
			}
		}

		const deduplicated = deduplicateProfiles(allProfiles);

		return {
			profiles: deduplicated,
			totalCount: total,
			nextCursor: null,
			source: sources.join(", ") || "discovery-engine",
		};
	}

	async getDetails(
		identifier: string,
		connectorId = "mcp-registry",
		options?: DetailOptions,
	): Promise<AgentProfile | null> {
		const connector = this.connectors.get(connectorId);
		if (!connector) {
			throw new Error(`Discovery connector '${connectorId}' not found.`);
		}

		return connector.getDetails(identifier, options);
	}
}

// Global singleton instance for runtime use
export const defaultDiscoveryEngine = new DiscoveryEngine();
