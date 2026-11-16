import test from "node:test";
import assert from "node:assert/strict";
import {
	GitHubClient,
	validateGitHubIdentifier,
} from "../../src/discovery/connectors/github/github-client.ts";
import type { GitHubRepository } from "../../src/discovery/connectors/github/types.ts";

const mockRepo: GitHubRepository = {
	id: 12345,
	name: "langgraph",
	full_name: "langchain-ai/langgraph",
	private: false,
	owner: {
		login: "langchain-ai",
		id: 54321,
		avatar_url: "https://avatars.githubusercontent.com/u/54321",
		html_url: "https://github.com/langchain-ai",
	},
	html_url: "https://github.com/langchain-ai/langgraph",
	description: "Build resilient language agents as graphs",
	fork: false,
	url: "https://api.github.com/repos/langchain-ai/langgraph",
	created_at: "2024-01-01T00:00:00Z",
	updated_at: "2024-06-01T00:00:00Z",
	pushed_at: "2024-06-02T00:00:00Z",
	homepage: "https://langchain-ai.github.io/langgraph/",
	size: 1024,
	stargazers_count: 5000,
	watchers_count: 5000,
	language: "Python",
	forks_count: 600,
	open_issues_count: 25,
	default_branch: "main",
	topics: ["agent", "langchain", "multi-agent"],
	license: {
		key: "mit",
		name: "MIT License",
		spdx_id: "MIT",
		url: "https://api.github.com/licenses/mit",
	},
};

test("validateGitHubIdentifier: validates safe alphanumeric identifiers and rejects unsafe paths", () => {
	assert.doesNotThrow(() => validateGitHubIdentifier("langchain-ai", "owner"));
	assert.doesNotThrow(() => validateGitHubIdentifier("langgraph", "repo"));
	assert.doesNotThrow(() => validateGitHubIdentifier("repo_with.dots-and_underscores", "repo"));

	assert.throws(() => validateGitHubIdentifier("", "owner"), /non-empty string/i);
	assert.throws(() => validateGitHubIdentifier(".", "repo"), /cannot be dot navigation/i);
	assert.throws(() => validateGitHubIdentifier("..", "repo"), /cannot be dot navigation/i);
	assert.throws(
		() => validateGitHubIdentifier("foo/bar", "owner"),
		/cannot contain path separators/i,
	);
	assert.throws(
		() => validateGitHubIdentifier("foo\\bar", "repo"),
		/cannot contain path separators/i,
	);
	assert.throws(() => validateGitHubIdentifier("a".repeat(101), "repo"), /Invalid repo/i);
});

test("GitHubClient: searchRepositories sends correct query parameters and parses valid results", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const urlStr = input.toString();
		assert.match(urlStr, /api\.github\.com\/search\/repositories/);
		assert.match(urlStr, /q=agent\+framework/);
		assert.match(urlStr, /per_page=15/);
		assert.match(urlStr, /page=2/);
		assert.match(urlStr, /sort=stars/);
		assert.match(urlStr, /order=desc/);

		const responseBody = {
			total_count: 1,
			incomplete_results: false,
			items: [mockRepo],
		};

		return new Response(JSON.stringify(responseBody), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
				"x-ratelimit-limit": "60",
				"x-ratelimit-remaining": "59",
				"x-ratelimit-reset": "1700000000",
			},
		});
	};

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const result = await client.searchRepositories({
		query: "agent framework",
		perPage: 15,
		page: 2,
		sort: "stars",
		order: "desc",
	});

	assert.equal(result.data.total_count, 1);
	assert.equal(result.data.items.length, 1);
	assert.equal(result.data.items[0].name, "langgraph");
	assert.equal(result.rateLimit.remaining, 59);
	assert.equal(result.rateLimit.limit, 60);
	assert.ok(result.rateLimit.reset);
});

test("GitHubClient: getRepository retrieves single repository details", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const urlStr = input.toString();
		assert.match(urlStr, /repos\/langchain-ai\/langgraph$/);

		return new Response(JSON.stringify(mockRepo), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	};

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const result = await client.getRepository("langchain-ai", "langgraph");

	assert.ok(result);
	assert.equal(result.data.name, "langgraph");
	assert.equal(result.data.owner.login, "langchain-ai");
	assert.equal(result.data.stargazers_count, 5000);
});

test("GitHubClient: getRepository returns null for 404 not found", async () => {
	const mockFetch = async () =>
		new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const result = await client.getRepository("unknown-owner", "nonexistent-repo");

	assert.equal(result, null);
});

test("GitHubClient: fetchAndDecodeReadme decodes base64 content including whitespace", async () => {
	const rawReadmeText = "# LangGraph Agent\n\nBuild autonomous agent workflows with state.";
	// Base64 encode with embedded newlines
	const b64 = Buffer.from(rawReadmeText).toString("base64");
	const b64WithNewlines = `${b64.slice(0, 10)}\n${b64.slice(10, 20)}\n${b64.slice(20)}`;

	const mockFetch = async (input: RequestInfo | URL) => {
		const urlStr = input.toString();
		assert.match(urlStr, /readme$/);

		return new Response(
			JSON.stringify({
				name: "README.md",
				path: "README.md",
				sha: "abc123",
				size: rawReadmeText.length,
				url: "https://api.github.com/repos/langchain-ai/langgraph/contents/README.md",
				html_url: "https://github.com/langchain-ai/langgraph/blob/main/README.md",
				type: "file",
				content: b64WithNewlines,
				encoding: "base64",
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	};

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const decoded = await client.fetchAndDecodeReadme("langchain-ai", "langgraph");

	assert.ok(decoded);
	assert.equal(decoded.name, "README.md");
	assert.equal(decoded.content, rawReadmeText);
});

test("GitHubClient: fetchAndDecodeReadme returns null when README does not exist (404)", async () => {
	const mockFetch = async () =>
		new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	const decoded = await client.fetchAndDecodeReadme("empty-owner", "no-readme");

	assert.equal(decoded, null);
});

test("GitHubClient: handles HTTP 403 rate limit with informative error message and reset timestamp", async () => {
	const mockFetch = async () =>
		new Response(
			JSON.stringify({
				message: "API rate limit exceeded for 192.0.2.1.",
				documentation_url:
					"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting",
			}),
			{
				status: 403,
				headers: {
					"Content-Type": "application/json",
					"x-ratelimit-remaining": "0",
					"x-ratelimit-limit": "60",
					"x-ratelimit-reset": "1700000000",
				},
			},
		);

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.searchRepositories({ query: "test" }),
		(err: any) => {
			assert.equal(err.status, 403);
			assert.match(err.message, /GitHub API rate limit exceeded \(HTTP 403\)/i);
			assert.match(err.message, /Remaining: 0/i);
			assert.match(err.message, /Resets at/i);
			return true;
		},
	);
});

test("GitHubClient: handles HTTP 429 secondary rate limit / abuse detection", async () => {
	const mockFetch = async () =>
		new Response("You have exceeded a secondary rate limit.", { status: 429 });

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.searchRepositories({ query: "test" }),
		/secondary rate limit triggered \(HTTP 429\)/i,
	);
});

test("GitHubClient: handles HTTP 500 server error", async () => {
	const mockFetch = async () =>
		new Response(JSON.stringify({ message: "Internal server error" }), { status: 500 });

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.searchRepositories({ query: "test" }),
		/GitHub API request failed with status 500/i,
	);
});

test("GitHubClient: handles network failures and timeouts cleanly", async () => {
	const mockFetchFail = async () => {
		throw new Error("DNS resolution failed");
	};
	const clientFail = new GitHubClient({ fetchFn: mockFetchFail as typeof fetch });
	await assert.rejects(
		() => clientFail.searchRepositories({ query: "test" }),
		/DNS resolution failed/i,
	);

	const mockFetchTimeout = async (_input: any, init: any) => {
		return new Promise<Response>((_resolve, reject) => {
			init.signal.addEventListener("abort", () => {
				const err = new Error("The operation was aborted");
				err.name = "AbortError";
				reject(err);
			});
		});
	};
	const clientTimeout = new GitHubClient({
		fetchFn: mockFetchTimeout as typeof fetch,
		timeoutMs: 30,
	});
	await assert.rejects(
		() => clientTimeout.searchRepositories({ query: "test" }),
		/timed out after 30ms/i,
	);
});

test("GitHubClient SSRF: blocks origin escape and protocol manipulation", async () => {
	const client = new GitHubClient();

	await assert.rejects(
		() => (client as any).request("https://evil.example.com/api"),
		/Security violation: GitHub client cannot request external origin/i,
	);

	await assert.rejects(
		() => (client as any).request("//evil.example.com/api"),
		/protocol-relative slash/i,
	);

	await assert.rejects(() => (client as any).request("/search\\repositories"), /backslash/i);
});

test("GitHubClient SSRF: follows same-origin redirects and blocks cross-origin redirects", async () => {
	let redirectCount = 0;
	const mockFetchSameOrigin = async (input: RequestInfo | URL) => {
		const urlStr = input.toString();
		if (urlStr === "https://api.github.com/step-1") {
			redirectCount++;
			return new Response(null, {
				status: 302,
				headers: { Location: "https://api.github.com/step-2" },
			});
		}
		if (urlStr === "https://api.github.com/step-2") {
			redirectCount++;
			return new Response(JSON.stringify({ total_count: 0, items: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const clientSame = new GitHubClient({ fetchFn: mockFetchSameOrigin as typeof fetch });
	const result = await (clientSame as any).request("/step-1");
	assert.equal(redirectCount, 2);
	assert.equal(result.data.total_count, 0);

	const mockFetchCrossOrigin = async () =>
		new Response(null, {
			status: 302,
			headers: { Location: "https://malicious.example.com/stolen" },
		});
	const clientCross = new GitHubClient({ fetchFn: mockFetchCrossOrigin as typeof fetch });
	await assert.rejects(
		() => (clientCross as any).request("/test"),
		/Security violation: GitHub redirect escaped allowed origin/i,
	);
});

test("GitHubClient: rejects oversized responses exceeding 1 MB limit", async () => {
	const mockFetch = async () => {
		const oversized = "a".repeat(1024 * 1024 + 100);
		return new Response(oversized, {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	};

	const client = new GitHubClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => (client as any).request("/oversized"),
		/exceeded maximum allowed limit/i,
	);
});
