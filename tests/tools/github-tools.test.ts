import test from "node:test";
import assert from "node:assert/strict";
import {
	handleSearchGithubAgents,
	searchGithubAgentsInputSchema,
} from "../../src/tools/discovery/search-github-agents.ts";
import {
	handleGetGithubAgentDetails,
	getGithubAgentDetailsInputSchema,
} from "../../src/tools/discovery/get-github-agent-details.ts";
import { GitHubClient } from "../../src/discovery/connectors/github/github-client.ts";
import type { GitHubRepository } from "../../src/discovery/connectors/github/types.ts";

const mockRepo: GitHubRepository = {
	id: 777,
	name: "smolagents",
	full_name: "huggingface/smolagents",
	private: false,
	owner: { login: "huggingface", id: 256 },
	html_url: "https://github.com/huggingface/smolagents",
	description: "A very small library to build autonomous agents",
	fork: false,
	url: "https://api.github.com/repos/huggingface/smolagents",
	created_at: "2024-05-01T00:00:00Z",
	updated_at: "2024-06-01T00:00:00Z",
	pushed_at: "2024-06-01T00:00:00Z",
	size: 500,
	stargazers_count: 8000,
	watchers_count: 8000,
	language: "Python",
	forks_count: 900,
	open_issues_count: 15,
	default_branch: "main",
	topics: ["smolagents", "agents", "tool-calling"],
};

test("search_github_agents: handler returns successful result for valid search query", async () => {
	const mockFetch = async () =>
		new Response(
			JSON.stringify({
				total_count: 1,
				items: [mockRepo],
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					"x-ratelimit-remaining": "50",
				},
			},
		);

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const result = await handleSearchGithubAgents({ query: "smolagents" }, client);

	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].type, "text");

	const parsed = JSON.parse(result.content[0].text);
	assert.equal(parsed.status, "discovered");
	assert.equal(parsed.count, 1);
	assert.equal(parsed.totalCount, 1);
	assert.equal(parsed.repositories[0].name, "smolagents");
	assert.equal(parsed.repositories[0].classification, "confirmed_agent");
	assert.equal(parsed.profiles[0].id, "github:huggingface/smolagents");
	assert.equal(parsed.profiles[0].trust.status, "declared");
});

test("search_github_agents: handler returns structured error on rate limit or API failure", async () => {
	const mockFetch = async () =>
		new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
			status: 403,
			headers: {
				"Content-Type": "application/json",
				"x-ratelimit-remaining": "0",
				"x-ratelimit-reset": "1700000000",
			},
		});

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const result = await handleSearchGithubAgents({ query: "agents" }, client);

	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /GitHub agent discovery failed/i);
	assert.match(result.content[0].text, /rate limit exceeded/i);
});

test("search_github_agents: schema validates query bounds and pagination options", () => {
	assert.doesNotThrow(() =>
		searchGithubAgentsInputSchema.parse({
			query: "langgraph",
			page: 2,
			per_page: 20,
			sort: "stars",
			order: "desc",
		}),
	);

	assert.throws(() => searchGithubAgentsInputSchema.parse({ query: "" }), /cannot be empty/i);
	assert.throws(
		() => searchGithubAgentsInputSchema.parse({ query: "a".repeat(201) }),
		/must not exceed 200 characters/i,
	);
	assert.throws(
		() => searchGithubAgentsInputSchema.parse({ query: "test", per_page: 55 }),
		/cannot exceed 50/i,
	);
});

test("get_github_agent_details: handler returns detailed information and profile", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const urlStr = input.toString();
		if (urlStr.includes("/readme")) {
			return new Response(
				JSON.stringify({
					name: "README.md",
					path: "README.md",
					sha: "sha999",
					size: 80,
					url: "https://api.github.com/repos/huggingface/smolagents/contents/README.md",
					html_url: "https://github.com/huggingface/smolagents/blob/main/README.md",
					type: "file",
					content: Buffer.from("# Smolagents\n\nRun code agent: agent.run()").toString(
						"base64",
					),
					encoding: "base64",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}
		if (urlStr.includes("/repos/huggingface/smolagents")) {
			return new Response(JSON.stringify(mockRepo), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const result = await handleGetGithubAgentDetails(
		{ owner: "huggingface", repo: "smolagents", include_readme: true },
		client,
	);

	assert.equal(result.isError, undefined);
	const parsed = JSON.parse(result.content[0].text);
	assert.equal(parsed.status, "success");
	assert.equal(parsed.repository.name, "smolagents");
	assert.equal(parsed.detection.classification, "confirmed_agent");
	assert.ok(parsed.readme);
	assert.equal(parsed.readme.fetched, true);
	assert.equal(parsed.profile.id, "github:huggingface/smolagents");
});

test("get_github_agent_details: handler returns structured error when repo not found", async () => {
	const mockFetch = async () =>
		new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const result = await handleGetGithubAgentDetails(
		{ owner: "unknown-owner", repo: "unknown-repo" },
		client,
	);

	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /was not found \(HTTP 404\)/i);
});

test("get_github_agent_details: schema enforces strict validation on owner and repository names", () => {
	assert.doesNotThrow(() =>
		getGithubAgentDetailsInputSchema.parse({ owner: "microsoft", repo: "autogen" }),
	);

	// Invalid characters or path traversal attempts
	assert.throws(
		() => getGithubAgentDetailsInputSchema.parse({ owner: "../microsoft", repo: "autogen" }),
		/valid GitHub username/i,
	);
	assert.throws(
		() => getGithubAgentDetailsInputSchema.parse({ owner: "microsoft", repo: "autogen/path" }),
		/alphanumeric characters, underscores, hyphens, or dots/i,
	);
	assert.throws(
		() => getGithubAgentDetailsInputSchema.parse({ owner: "microsoft", repo: "." }),
		/dot navigation/i,
	);
	assert.throws(
		() => getGithubAgentDetailsInputSchema.parse({ owner: "microsoft", repo: ".." }),
		/dot navigation/i,
	);
});
