import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGitHubRepository } from "../../src/discovery/normalizer/github-repo-normalizer.ts";
import { agentProfileSchema } from "../../src/discovery/types/agent-profile.ts";
import type { GitHubRepository } from "../../src/discovery/connectors/github/types.ts";

test("github-normalizer: maps full GitHub repository to valid AgentProfile", () => {
	const repo: GitHubRepository = {
		id: 98765,
		name: "crewAI",
		full_name: "joaomdmoura/crewAI",
		private: false,
		owner: {
			login: "joaomdmoura",
			id: 11111,
			avatar_url: "https://avatars.githubusercontent.com/u/11111",
			html_url: "https://github.com/joaomdmoura",
		},
		html_url: "https://github.com/joaomdmoura/crewAI",
		description: "Framework for orchestrating role-playing, autonomous AI agents",
		fork: false,
		url: "https://api.github.com/repos/joaomdmoura/crewAI",
		created_at: "2023-11-01T00:00:00Z",
		updated_at: "2024-06-01T00:00:00Z",
		pushed_at: "2024-06-01T12:00:00Z",
		homepage: "https://crewai.com",
		size: 2048,
		stargazers_count: 18500,
		watchers_count: 18500,
		language: "Python",
		forks_count: 2300,
		open_issues_count: 85,
		default_branch: "main",
		topics: ["ai", "agents", "multi-agent", "orchestration"],
		license: {
			key: "mit",
			name: "MIT License",
			spdx_id: "MIT",
			url: "https://api.github.com/licenses/mit",
		},
	};

	const profile = normalizeGitHubRepository(repo);

	// Validate against strict AgentProfile schema
	assert.doesNotThrow(() => agentProfileSchema.parse(profile));

	assert.equal(profile.id, "github:joaomdmoura/crewai");
	assert.equal(profile.name, "crewAI");
	assert.equal(profile.source.type, "github");
	assert.equal(profile.source.name, "GitHub");
	assert.equal(profile.source.identifier, "joaomdmoura/crewAI");
	assert.equal(profile.source.url, "https://github.com/joaomdmoura/crewAI");

	// Semantic corrections: No fake protocols, no fake endpoint, undeclared auth
	assert.deepEqual(profile.communication.protocols, []);
	assert.equal(profile.communication.endpoint, undefined);
	assert.equal(profile.authentication.required, false);
	assert.deepEqual(profile.authentication.declaredMethods, []);

	// Categories: MIT license gets open-source tag
	assert.ok(profile.classification.categories.includes("open-source"));

	// Trust status must remain declared despite 18500 stars
	assert.equal(profile.trust.status, "declared");
	assert.match(profile.trust.notes || "", /18500 stars/);

	// Metadata: version is absent when undeclared (not branch name)
	assert.equal(profile.metadata.version, undefined);
	assert.equal(profile.metadata.provider, "joaomdmoura");
	assert.equal(profile.metadata.documentationUrl, "https://crewai.com/");
	assert.equal(profile.metadata.iconUrl, "https://avatars.githubusercontent.com/u/11111");

	// GitHub specific metadata
	const ghMeta = profile.metadata.github as any;
	assert.ok(ghMeta);
	assert.equal(ghMeta.defaultBranch, "main");
	assert.equal(ghMeta.stars, 18500);
	assert.equal(ghMeta.forks, 2300);
	assert.equal(ghMeta.language, "Python");
	assert.equal(ghMeta.license, "MIT");
});

test("github-normalizer: handles minimal repository with null fields safely", () => {
	const minimalRepo: GitHubRepository = {
		id: 1,
		name: "minimal-agent",
		full_name: "dev/minimal-agent",
		private: false,
		owner: { login: "dev", id: 2 },
		html_url: "https://github.com/dev/minimal-agent",
		description: null,
		fork: false,
		url: "https://api.github.com/repos/dev/minimal-agent",
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		pushed_at: "2024-01-01T00:00:00Z",
		homepage: null,
		size: 0,
		stargazers_count: 0,
		watchers_count: 0,
		language: null,
		forks_count: 0,
		open_issues_count: 0,
		default_branch: "master",
		topics: [],
		license: null,
	};

	const profile = normalizeGitHubRepository(minimalRepo);
	assert.doesNotThrow(() => agentProfileSchema.parse(profile));

	assert.equal(profile.id, "github:dev/minimal-agent");
	assert.equal(profile.metadata.version, undefined);
	assert.equal(profile.description, "");
	assert.equal(profile.metadata.documentationUrl, "https://github.com/dev/minimal-agent");
	assert.equal(profile.metadata.iconUrl, undefined);
	assert.equal(profile.trust.status, "declared");

	// Categories: without open-source license, must NOT include open-source
	assert.ok(!profile.classification.categories.includes("open-source"));
	assert.deepEqual(profile.communication.protocols, []);
	assert.equal(profile.communication.endpoint, undefined);
});

test("github-normalizer: proprietary or non-open-source license does not receive open-source category", () => {
	const proprietaryRepo: GitHubRepository = {
		id: 2,
		name: "prop-agent",
		full_name: "corp/prop-agent",
		private: false,
		owner: { login: "corp", id: 3 },
		html_url: "https://github.com/corp/prop-agent",
		description: "Proprietary internal agent",
		fork: false,
		url: "https://api.github.com/repos/corp/prop-agent",
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		pushed_at: "2024-01-01T00:00:00Z",
		homepage: null,
		size: 100,
		stargazers_count: 5,
		watchers_count: 5,
		language: "TypeScript",
		forks_count: 0,
		open_issues_count: 0,
		default_branch: "main",
		topics: ["agent"],
		license: {
			key: "other",
			name: "Other License",
			spdx_id: "NOASSERTION",
			url: null,
		},
	};

	const profile = normalizeGitHubRepository(proprietaryRepo);
	assert.ok(!profile.classification.categories.includes("open-source"));
});
