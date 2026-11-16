import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";
import { GitHubClient } from "../../discovery/connectors/github/github-client.ts";
import { detectGitHubAgent } from "../../discovery/connectors/github/github-agent-detector.ts";
import { normalizeGitHubRepository } from "../../discovery/normalizer/github-repo-normalizer.ts";

export const getGithubAgentDetailsInputSchema = z.object({
	owner: z
		.string()
		.trim()
		.min(1, "Owner cannot be empty")
		.max(39, "Owner must not exceed 39 characters")
		.regex(
			/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/,
			"Owner must be a valid GitHub username or organization name",
		)
		.describe("GitHub repository owner or organization name (e.g. 'langchain-ai')"),
	repo: z
		.string()
		.trim()
		.min(1, "Repository name cannot be empty")
		.max(100, "Repository name must not exceed 100 characters")
		.regex(
			/^[a-zA-Z0-9_.-]{1,100}$/,
			"Repository name must contain only alphanumeric characters, underscores, hyphens, or dots",
		)
		.refine(
			(val) => val !== "." && val !== "..",
			"Repository name cannot be dot navigation ('.' or '..')",
		)
		.describe("GitHub repository name (e.g. 'langgraph')"),
	include_readme: z
		.boolean()
		.default(false)
		.describe(
			"Whether to retrieve and safely inspect the repository README for deeper agent capability evidence (default: false)",
		),
});

export type GetGithubAgentDetailsInput = z.input<typeof getGithubAgentDetailsInputSchema>;

export async function handleGetGithubAgentDetails(
	input: GetGithubAgentDetailsInput,
	client: GitHubClient = new GitHubClient(),
) {
	try {
		const parsed = getGithubAgentDetailsInputSchema.parse(input);
		const repoResult = await client.getRepository(parsed.owner, parsed.repo);

		if (!repoResult) {
			return createErrorResult(
				`GitHub repository '${parsed.owner}/${parsed.repo}' was not found (HTTP 404).`,
			);
		}

		let readmeSummary: { fetched: boolean; name?: string; size?: number; excerpt?: string } = {
			fetched: false,
		};
		let readmeContent: string | null = null;

		if (parsed.include_readme) {
			const decodedReadme = await client.fetchAndDecodeReadme(parsed.owner, parsed.repo);
			if (decodedReadme) {
				readmeContent = decodedReadme.content;
				readmeSummary = {
					fetched: true,
					name: decodedReadme.name,
					size: decodedReadme.size,
					excerpt: decodedReadme.content.slice(0, 500),
				};
			} else {
				readmeSummary = {
					fetched: true,
					excerpt: "No README found in repository.",
				};
			}
		}

		const detection = detectGitHubAgent(repoResult.data, readmeContent);
		const profile = normalizeGitHubRepository(repoResult.data, detection, readmeContent);

		const responsePayload = {
			status: "success",
			repository: {
				id: repoResult.data.id,
				name: repoResult.data.name,
				fullName: repoResult.data.full_name,
				owner: repoResult.data.owner.login,
				htmlUrl: repoResult.data.html_url,
				description: repoResult.data.description || "",
				stars: repoResult.data.stargazers_count,
				forks: repoResult.data.forks_count,
				openIssues: repoResult.data.open_issues_count,
				defaultBranch: repoResult.data.default_branch,
				language: repoResult.data.language,
				topics: repoResult.data.topics || [],
				license: repoResult.data.license?.spdx_id || repoResult.data.license?.name || null,
				pushedAt: repoResult.data.pushed_at,
				updatedAt: repoResult.data.updated_at,
			},
			detection: {
				classification: detection.classification,
				confidenceScore: detection.confidenceScore,
				detectedFrameworks: detection.detectedFrameworks,
				detectedCapabilities: detection.detectedCapabilities,
				inferredSkills: detection.inferredSkills,
				evidence: detection.evidence,
			},
			readme: parsed.include_readme ? readmeSummary : undefined,
			rateLimit: repoResult.rateLimit,
			profile,
		};

		return createTextResult(JSON.stringify(responsePayload, null, 2));
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return createErrorResult(`Failed to retrieve GitHub agent details: ${message}`);
	}
}

export function registerGetGithubAgentDetailsTool(
	server: McpServer,
	client: GitHubClient = new GitHubClient(),
): void {
	server.registerTool(
		"get_github_agent_details",
		{
			description:
				"Retrieve detailed metadata, agent classification, confidence score, evidence, and normalized Universal Agent Profile for a specific GitHub repository.",
			inputSchema: getGithubAgentDetailsInputSchema,
		},
		(args) => handleGetGithubAgentDetails(args, client),
	);
}
