import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";
import { GitHubClient } from "../../discovery/connectors/github/github-client.ts";
import { detectGitHubAgent } from "../../discovery/connectors/github/github-agent-detector.ts";
import { normalizeGitHubRepository } from "../../discovery/normalizer/github-repo-normalizer.ts";
import { deduplicateProfiles } from "../../discovery/deduplication/deduplicator.ts";

export const searchGithubAgentsInputSchema = z.object({
	query: z
		.string()
		.trim()
		.min(1, "Search query cannot be empty")
		.max(200, "Search query must not exceed 200 characters")
		.describe(
			"Search keywords or GitHub qualifiers (e.g. 'agent framework', 'langgraph in:description', 'topic:autonomous-agents')",
		),
	page: z
		.number()
		.int("Page must be an integer")
		.min(1, "Page must be at least 1")
		.default(1)
		.describe("Page number for pagination (default: 1)"),
	per_page: z
		.number()
		.int("per_page must be an integer")
		.min(1, "per_page must be at least 1")
		.max(50, "per_page cannot exceed 50")
		.default(10)
		.describe("Number of repository results per page (1-50, default: 10)"),
	sort: z
		.enum(["stars", "forks", "updated", "help-wanted-issues"])
		.optional()
		.describe("Sort field for repository results (default: best match)"),
	order: z
		.enum(["asc", "desc"])
		.default("desc")
		.describe("Sort order: asc or desc (default: desc)"),
});

export type SearchGithubAgentsInput = z.input<typeof searchGithubAgentsInputSchema>;

export async function handleSearchGithubAgents(
	input: SearchGithubAgentsInput,
	client: GitHubClient = new GitHubClient(),
) {
	try {
		const parsed = searchGithubAgentsInputSchema.parse(input);
		const result = await client.searchRepositories({
			query: parsed.query,
			page: parsed.page,
			perPage: parsed.per_page,
			sort: parsed.sort,
			order: parsed.order,
		});

		const repositoriesSummary = [];
		const rawProfiles = [];

		for (const repo of result.data.items) {
			const detection = detectGitHubAgent(repo);
			const profile = normalizeGitHubRepository(repo, detection);
			rawProfiles.push(profile);

			repositoriesSummary.push({
				name: repo.name,
				fullName: repo.full_name,
				htmlUrl: repo.html_url,
				description: repo.description || "",
				stars: repo.stargazers_count,
				forks: repo.forks_count,
				language: repo.language,
				topics: repo.topics || [],
				license: repo.license?.spdx_id || repo.license?.name || null,
				classification: detection.classification,
				confidenceScore: detection.confidenceScore,
				detectedFrameworks: detection.detectedFrameworks,
				detectedCapabilities: detection.detectedCapabilities,
				evidence: detection.evidence,
			});
		}

		const deduplicatedProfiles = deduplicateProfiles(rawProfiles);

		const responsePayload = {
			status: "discovered",
			query: parsed.query,
			count: repositoriesSummary.length,
			totalCount: result.data.total_count,
			page: parsed.page,
			perPage: parsed.per_page,
			rateLimit: result.rateLimit,
			repositories: repositoriesSummary,
			profiles: deduplicatedProfiles,
		};

		return createTextResult(JSON.stringify(responsePayload, null, 2));
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return createErrorResult(`GitHub agent discovery failed: ${message}`);
	}
}

export function registerSearchGithubAgentsTool(
	server: McpServer,
	client: GitHubClient = new GitHubClient(),
): void {
	server.registerTool(
		"search_github_agents",
		{
			description:
				"Discover AI agent repositories, agent frameworks, multi-agent systems, and MCP/A2A projects on GitHub using public repository search.",
			inputSchema: searchGithubAgentsInputSchema,
		},
		(args) => handleSearchGithubAgents(args, client),
	);
}
