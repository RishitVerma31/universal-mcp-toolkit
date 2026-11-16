import type {
	DetailOptions,
	DiscoveryConnector,
	DiscoveryQuery,
	DiscoveryResult,
} from "../../types/connector.ts";
import type { AgentProfile } from "../../types/agent-profile.ts";
import { GitHubClient } from "./github-client.ts";
import { normalizeGitHubRepository } from "../../normalizer/github-repo-normalizer.ts";
import { deduplicateProfiles } from "../../deduplication/deduplicator.ts";

export interface GitHubDetailOptions extends DetailOptions {
	includeReadme?: boolean;
}

export class GitHubConnector implements DiscoveryConnector {
	readonly id = "github";
	readonly name = "GitHub Public Repository Agent Discovery";
	private readonly client: GitHubClient;

	constructor(client: GitHubClient = new GitHubClient()) {
		this.client = client;
	}

	async search(query: DiscoveryQuery): Promise<DiscoveryResult> {
		const rawQuery = (query.query || "").trim();
		if (!rawQuery) {
			return {
				profiles: [],
				totalCount: 0,
				nextCursor: null,
				source: "github",
			};
		}

		// Parse pagination cursor
		let page = 1;
		if (query.cursor) {
			const parsedPage = parseInt(query.cursor, 10);
			if (!isNaN(parsedPage) && parsedPage >= 1) {
				page = parsedPage;
			}
		}

		const perPage = Math.max(1, Math.min(100, query.limit || 10));

		const result = await this.client.searchRepositories({
			query: rawQuery,
			perPage,
			page,
		});

		const profiles: AgentProfile[] = [];
		for (const repo of result.data.items) {
			try {
				const profile = normalizeGitHubRepository(repo);
				profiles.push(profile);
			} catch {
				// Isolate individual corrupt repository records
			}
		}

		const deduplicated = deduplicateProfiles(profiles);

		const total = result.data.total_count;
		const hasMore = page * perPage < total;
		const nextCursor = hasMore ? String(page + 1) : null;

		return {
			profiles: deduplicated,
			totalCount: total,
			nextCursor,
			source: "github",
		};
	}

	async getDetails(
		identifier: string,
		options?: GitHubDetailOptions,
	): Promise<AgentProfile | null> {
		const parsed = this.parseOwnerAndRepo(identifier);
		if (!parsed) {
			return null;
		}

		const { owner, repo } = parsed;

		const repoResult = await this.client.getRepository(owner, repo);
		if (!repoResult) {
			return null;
		}

		let readmeContent: string | null = null;
		if (options?.includeReadme) {
			const readmeResult = await this.client.fetchAndDecodeReadme(owner, repo);
			if (readmeResult) {
				readmeContent = readmeResult.content;
			}
		}

		try {
			return normalizeGitHubRepository(repoResult.data, undefined, readmeContent);
		} catch {
			return null;
		}
	}

	private parseOwnerAndRepo(identifier: string): { owner: string; repo: string } | null {
		if (!identifier || typeof identifier !== "string") {
			return null;
		}

		let cleaned = identifier.trim();

		// Handle github:owner/repo@branch
		if (cleaned.startsWith("github:")) {
			cleaned = cleaned.slice(7);
			const atIdx = cleaned.indexOf("@");
			if (atIdx !== -1) {
				cleaned = cleaned.slice(0, atIdx);
			}
		}

		// Handle full GitHub URL: https://github.com/owner/repo
		if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
			try {
				const url = new URL(cleaned);
				if (url.hostname.toLowerCase() === "github.com") {
					const parts = url.pathname.split("/").filter(Boolean);
					if (parts.length >= 2) {
						return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
					}
				}
				return null;
			} catch {
				return null;
			}
		}

		// Handle owner/repo
		const parts = cleaned.split("/").filter(Boolean);
		if (parts.length === 2) {
			return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
		}

		return null;
	}
}
