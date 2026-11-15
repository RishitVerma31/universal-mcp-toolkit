import type { AgentProfile } from "../types/agent-profile.ts";

/**
 * Builds a deterministic, collision-resistant key for an AgentProfile.
 * Incorporates source type, unique source identifier, and version to ensure
 * different versions or different origin catalogs remain distinct.
 */
export function getProfileDeduplicationKey(profile: AgentProfile): string {
	const sourceType = (profile.source?.type || "unknown").toLowerCase();
	const identifier = (profile.source?.identifier || profile.id || "").toLowerCase();
	const version = (profile.metadata?.version || "default").toLowerCase();

	return `${sourceType}:::${identifier}:::${version}`;
}

/**
 * Deduplicates an array of AgentProfiles while preserving the order of first occurrence.
 * Distinguishes different versions of the same agent and avoids merging different
 * agents that happen to share a common display name.
 */
export function deduplicateProfiles(profiles: AgentProfile[]): AgentProfile[] {
	const seen = new Set<string>();
	const result: AgentProfile[] = [];

	for (const profile of profiles) {
		const key = getProfileDeduplicationKey(profile);
		if (!seen.has(key)) {
			seen.add(key);
			result.push(profile);
		}
	}

	return result;
}
