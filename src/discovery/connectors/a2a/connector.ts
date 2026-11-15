import type {
	DetailOptions,
	DiscoveryConnector,
	DiscoveryQuery,
	DiscoveryResult,
} from "../../types/connector.ts";
import type { AgentProfile } from "../../types/agent-profile.ts";
import { A2AAgentCardClient } from "./client.ts";
import type { A2AAgentCardClientOptions } from "./client.ts";
import { normalizeA2aAgentCard } from "../../normalizer/a2a-agent-card-normalizer.ts";

export class A2AAgentCardConnector implements DiscoveryConnector {
	readonly id = "a2a";
	readonly name = "A2A Protocol Agent Card Discovery";
	private readonly client: A2AAgentCardClient;

	constructor(clientOrOptions?: A2AAgentCardClient | A2AAgentCardClientOptions) {
		if (clientOrOptions instanceof A2AAgentCardClient) {
			this.client = clientOrOptions;
		} else {
			this.client = new A2AAgentCardClient(clientOrOptions);
		}
	}

	async search(query: DiscoveryQuery): Promise<DiscoveryResult> {
		const rawQuery = (query.query || "").trim();

		// If query looks like an HTTPS URL, attempt direct A2A agent discovery
		if (rawQuery.startsWith("https://")) {
			try {
				const discovery = await this.client.fetchAgentCard(rawQuery);
				const profile = normalizeA2aAgentCard(discovery.card, discovery.agentCardUrl);
				return {
					profiles: [profile],
					totalCount: 1,
					nextCursor: null,
					source: "a2a",
				};
			} catch {
				return {
					profiles: [],
					totalCount: 0,
					nextCursor: null,
					source: "a2a",
				};
			}
		}

		// A2A is endpoint-based discovery without a centralized global search index
		return {
			profiles: [],
			totalCount: 0,
			nextCursor: null,
			source: "a2a",
		};
	}

	async getDetails(
		identifier: string,
		_options: DetailOptions = {},
	): Promise<AgentProfile | null> {
		const targetUrl = (identifier || "").trim();
		if (!targetUrl.startsWith("https://")) {
			return null;
		}

		try {
			const discovery = await this.client.fetchAgentCard(targetUrl);
			return normalizeA2aAgentCard(discovery.card, discovery.agentCardUrl);
		} catch {
			return null;
		}
	}
}
