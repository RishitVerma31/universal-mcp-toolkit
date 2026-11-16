import test from "node:test";
import assert from "node:assert/strict";
import { detectGitHubAgent } from "../../src/discovery/connectors/github/github-agent-detector.ts";
import type { GitHubRepository } from "../../src/discovery/connectors/github/types.ts";

function createMockRepo(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
	return {
		id: 1,
		name: "test-repo",
		full_name: "test-owner/test-repo",
		private: false,
		owner: { login: "test-owner", id: 1 },
		html_url: "https://github.com/test-owner/test-repo",
		description: "A test repository",
		fork: false,
		url: "https://api.github.com/repos/test-owner/test-repo",
		created_at: "2024-01-01T00:00:00Z",
		updated_at: "2024-01-01T00:00:00Z",
		pushed_at: "2024-01-01T00:00:00Z",
		size: 100,
		stargazers_count: 50,
		watchers_count: 50,
		language: "Python",
		forks_count: 5,
		open_issues_count: 2,
		default_branch: "main",
		topics: [],
		...overrides,
	};
}

test("detectGitHubAgent: detects known frameworks (LangGraph, CrewAI, AutoGen, MCP)", () => {
	const langgraphRepo = createMockRepo({
		name: "customer-support-agent",
		description: "Customer service agent powered by LangGraph with tool use",
		topics: ["langgraph", "agent", "tool-calling"],
	});
	const d1 = detectGitHubAgent(langgraphRepo);
	assert.ok(d1.detectedFrameworks.includes("LangGraph"));
	assert.equal(d1.classification, "confirmed_agent");
	assert.ok(d1.confidenceScore >= 0.7);
	assert.ok(d1.detectedCapabilities.includes("tool-use"));

	const crewaiRepo = createMockRepo({
		name: "marketing-crew",
		description: "Multi-agent crew for content creation using CrewAI",
		topics: ["crewai", "multi-agent"],
	});
	const d2 = detectGitHubAgent(crewaiRepo);
	assert.ok(d2.detectedFrameworks.includes("CrewAI"));
	assert.ok(d2.detectedCapabilities.includes("multi-agent"));
	assert.equal(d2.classification, "confirmed_agent");

	const mcpRepo = createMockRepo({
		name: "sqlite-mcp-server",
		description: "Model Context Protocol server for SQLite databases",
		topics: ["modelcontextprotocol", "mcp-server"],
	});
	const d3 = detectGitHubAgent(mcpRepo);
	assert.ok(d3.detectedFrameworks.includes("MCP Agent / Server"));
	assert.ok(d3.detectedCapabilities.includes("mcp-server"));
});

test("detectGitHubAgent: identifies agent frameworks and libraries", () => {
	const frameworkRepo = createMockRepo({
		name: "agenthive",
		description: "A lightweight framework for building autonomous agents in TypeScript",
		topics: ["agent-framework", "agents", "sdk"],
	});
	const d = detectGitHubAgent(frameworkRepo);
	assert.equal(d.classification, "framework_library");
	assert.ok(d.confidenceScore >= 0.7);
	assert.ok(d.evidence.some((e) => e.includes("framework") || e.includes("library")));
});

test("detectGitHubAgent: classifies custom emerging agent projects without known framework keywords", () => {
	const customRepo = createMockRepo({
		name: "autonomous-coding-agent",
		description: "An autonomous agent loop that executes code and refactors repositories",
		topics: ["autonomous-agents", "code-execution"],
	});
	const d = detectGitHubAgent(customRepo);
	assert.equal(d.classification, "confirmed_agent");
	assert.ok(d.confidenceScore >= 0.6);
	assert.ok(d.detectedCapabilities.includes("autonomous-loop"));
	assert.ok(d.detectedCapabilities.includes("code-execution"));
	assert.equal(d.detectedFrameworks.length, 0); // No hardcoded framework was used
});

test("detectGitHubAgent: classifies general AI / ML projects as general_ai and not agents", () => {
	const mlRepo = createMockRepo({
		name: "resnet-pytorch-benchmark",
		description: "Benchmark ResNet architectures on ImageNet dataset using PyTorch",
		topics: ["pytorch", "computer-vision", "deep-learning", "dataset"],
	});
	const d = detectGitHubAgent(mlRepo);
	assert.equal(d.classification, "general_ai");
	assert.ok(d.confidenceScore <= 0.3);
	assert.equal(d.detectedFrameworks.length, 0);
	assert.equal(d.detectedCapabilities.length, 0);
});

test("detectGitHubAgent: classifies unrelated non-AI repositories as insufficient_evidence", () => {
	const webRepo = createMockRepo({
		name: "personal-website",
		description: "My personal blog built with Hugo and TailwindCSS",
		topics: ["html", "css", "blog"],
	});
	const d = detectGitHubAgent(webRepo);
	assert.equal(d.classification, "insufficient_evidence");
	assert.ok(d.confidenceScore <= 0.2);
});

test("detectGitHubAgent: extracts agent execution loop and tool calling evidence from README", () => {
	const repo = createMockRepo({
		name: "research-assistant",
		description: "AI assistant",
	});
	const readme = `
# Research Assistant

Run the agent:
\`\`\`python
from assistant import Agent
agent = Agent.run("summarize papers")
\`\`\`

Configured tools:
\`\`\`python
tools = [search_arxiv, download_pdf]
\`\`\`
`;
	const d = detectGitHubAgent(repo, readme);
	assert.ok(d.evidence.some((e) => e === "readme:agent-execution-api"));
	assert.ok(d.evidence.some((e) => e === "readme:tool-definition"));
	assert.ok(d.detectedCapabilities.includes("tool-use"));
	assert.ok(d.inferredSkills.includes("tool-calling"));
});

test("detectGitHubAgent: confidence scores stay strictly bounded between 0.0 and 1.0", () => {
	const veryStrongRepo = createMockRepo({
		name: "autogen-studio-agentic-framework",
		description:
			"Autonomous multi-agent framework powered by AutoGen with tools, code execution, and memory",
		topics: ["autogen", "agent-framework", "autonomous-agents", "multi-agent", "agentic-ai"],
	});
	const readme = "agent.run() tools = [search] system_prompt = 'Act as agent'";
	const dStrong = detectGitHubAgent(veryStrongRepo, readme);
	assert.ok(dStrong.confidenceScore >= 0.0 && dStrong.confidenceScore <= 1.0);

	const emptyRepo = createMockRepo();
	const dEmpty = detectGitHubAgent(emptyRepo);
	assert.ok(dEmpty.confidenceScore >= 0.0 && dEmpty.confidenceScore <= 1.0);
});

test("detectGitHubAgent regression: framework_library precedence prevents classification as operational agent", () => {
	const frameworkRepo = createMockRepo({
		name: "open-agent-framework",
		description: "A framework for building autonomous agents with multi-agent orchestration",
		topics: ["agent-framework", "autonomous-agents", "multi-agent", "agents"],
	});
	const readme = "agent.run() tools = [search] python_repl";
	const d = detectGitHubAgent(frameworkRepo, readme);
	// Even though score is very high and substantive evidence exists, framework_library takes precedence
	assert.equal(d.classification, "framework_library");
	assert.notEqual(d.classification, "confirmed_agent");
});

test("detectGitHubAgent regression: README capabilities are explicitly tagged with inferred:readme:capability", () => {
	const repo = createMockRepo({
		name: "simple-assistant",
		description: "A helpful assistant",
		topics: [],
	});
	const readme = "Supports streaming responses and agent memory retention";
	const d = detectGitHubAgent(repo, readme);
	assert.ok(d.evidence.includes("inferred:readme:capability:streaming"));
	assert.ok(d.evidence.includes("inferred:readme:capability:memory"));
	// Should not be falsely marked as metadata
	assert.ok(!d.evidence.includes("metadata:capability:streaming"));
	assert.ok(!d.evidence.includes("metadata:capability:memory"));
});

test("detectGitHubAgent regression: generic README prose does NOT trigger code-execution capability", () => {
	const repo = createMockRepo({
		name: "safe-text-bot",
		description: "An AI chat helper",
		topics: ["ai-agent"],
	});
	// Generic prose mentioning code execution or code executing
	const readme =
		"Security notice: this bot completely prevents arbitrary code execution and will not execute code.";
	const d = detectGitHubAgent(repo, readme);
	assert.ok(!d.detectedCapabilities.includes("code-execution"));
	assert.ok(!d.evidence.some((e) => e.includes("code-execution")));

	// Explicit sandbox marker in README DOES trigger code-execution
	const sandboxReadme = "Features an isolated python_repl environment for data science.";
	const d2 = detectGitHubAgent(repo, sandboxReadme);
	assert.ok(d2.detectedCapabilities.includes("code-execution"));
	assert.ok(d2.evidence.includes("inferred:readme:capability:code-execution"));
});

test("detectGitHubAgent regression: weak keyword matches produce likely_agent, NOT confirmed_agent", () => {
	const weakRepo = createMockRepo({
		name: "my-weather-agent",
		description: "Weather bot",
		topics: ["agent"],
	});
	const d = detectGitHubAgent(weakRepo);
	// Has repo name 'agent' and topic 'agent', but lacks substantive evidence (no framework, <2 capabilities, no execution API)
	assert.equal(d.classification, "likely_agent");
	assert.notEqual(d.classification, "confirmed_agent");
});
