import type { AgentProfile } from "./agent-profile.ts";

export interface DiscoveryQuery {
	query: string;
	limit?: number;
	cursor?: string;
	latestOnly?: boolean;
}

export interface DiscoveryResult {
	profiles: AgentProfile[];
	totalCount?: number;
	nextCursor?: string | null;
	source: string;
}

export interface DetailOptions {
	version?: string;
}

export interface DiscoveryConnector {
	readonly id: string;
	readonly name: string;
	search(query: DiscoveryQuery): Promise<DiscoveryResult>;
	getDetails(identifier: string, options?: DetailOptions): Promise<AgentProfile | null>;
}
