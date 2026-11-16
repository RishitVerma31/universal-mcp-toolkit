import test from "node:test";
import assert from "node:assert/strict";
import { GitHubConnector } from "../../src/discovery/connectors/github/connector.ts";
import { GitHubClient } from "../../src/discovery/connectors/github/github-client.ts";
import { DiscoveryEngine } from "../../src/discovery/search/discovery-engine.ts";
import type { GitHubRepository } from "../../src/discovery/connectors/github/types.ts";

const sampleRepo: GitHubRepository = {
	id: 42,
	name: "autogen",
	full_name: "microsoft/autogen",
	private: false,
	owner: { login: "microsoft", id: 1 },
	html_url: "https://github.com/microsoft/autogen",
	description: "A programming framework for agentic AI",
	fork: false,
	url: "https://api.github.com/repos/microsoft/autogen",
	created_at: "2023-08-01T00:00:00Z",
	updated_at: "2024-06-01T00:00:00Z",
	pushed_at: "2024-06-01T00:00:00Z",
	homepage: "https://microsoft.github.io/autogen/",
	size: 1500,
	stargazers_count: 28000,
	watchers_count: 28000,
	language: "Python",
	forks_count: 4000,
	open_issues_count: 120,
	default_branch: "main",
	topics: ["multi-agent", "autogen", "ai"],
};

test("GitHubConnector: metadata and search execution", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const urlStr = input.toString();
		if (urlStr.includes("/search/repositories")) {
			return new Response(
				JSON.stringify({
					total_count: 15,
					items: [sampleRepo],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const connector = new GitHubConnector(client);

	assert.equal(connector.id, "github");
	assert.equal(connector.name, "GitHub Public Repository Agent Discovery");

	// 1. Search with query
	const result = await connector.search({ query: "autogen", limit: 5 });
	assert.equal(result.source, "github");
	assert.equal(result.totalCount, 15);
	assert.equal(result.profiles.length, 1);
	assert.equal(result.profiles[0].id, "github:microsoft/autogen");
	assert.equal(result.nextCursor, "2");

	// 2. Empty query returns empty results
	const emptyRes = await connector.search({ query: "" });
	assert.equal(emptyRes.profiles.length, 0);
	assert.equal(emptyRes.nextCursor, null);
});

test("GitHubConnector: getDetails resolves owner/repo, GitHub URLs, and handles missing repos", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const urlStr = input.toString();
		if (urlStr.includes("/repos/microsoft/autogen/readme")) {
			return new Response(
				JSON.stringify({
					name: "README.md",
					path: "README.md",
					sha: "sha123",
					size: 100,
					url: "https://api.github.com/repos/microsoft/autogen/contents/README.md",
					html_url: "https://github.com/microsoft/autogen/blob/main/README.md",
					type: "file",
					content: Buffer.from("# AutoGen Framework\n\nagent.run()").toString("base64"),
					encoding: "base64",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			);
		}
		if (urlStr.includes("/repos/microsoft/autogen")) {
			return new Response(JSON.stringify(sampleRepo), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const connector = new GitHubConnector(client);

	// By owner/repo
	const p1 = await connector.getDetails("microsoft/autogen");
	assert.ok(p1);
	assert.equal(p1?.name, "autogen");

	// By GitHub URL
	const p2 = await connector.getDetails("https://github.com/microsoft/autogen");
	assert.ok(p2);
	assert.equal(p2?.id, "github:microsoft/autogen");

	// By URN
	const p3 = await connector.getDetails("github:microsoft/autogen@main");
	assert.ok(p3);
	assert.equal(p3?.name, "autogen");

	// With README inspection
	const p4 = await connector.getDetails("microsoft/autogen", { includeReadme: true });
	assert.ok(p4);
	assert.ok(
		p4?.classification.capabilities.includes("autonomous-loop") ||
			p4?.classification.capabilities.includes("multi-agent"),
	);

	// Invalid identifier
	const invalid = await connector.getDetails("not-a-valid-identifier");
	assert.equal(invalid, null);

	// Missing repo
	const notFound = await connector.getDetails("microsoft/nonexistent");
	assert.equal(notFound, null);
});

test("DiscoveryEngine: registers mcp-registry, a2a, and github connectors by default", async () => {
	const engine = new DiscoveryEngine();
	const connectors = engine.listConnectors();
	assert.equal(connectors.length, 3);
	assert.equal(connectors[0].id, "mcp-registry");
	assert.equal(connectors[1].id, "a2a");
	assert.equal(connectors[2].id, "github");
});
