import test from "node:test";
import assert from "node:assert/strict";
import {
	handleDiscoverA2aAgent,
	discoverA2aAgentInputSchema,
} from "../../src/tools/discovery/discover-a2a-agent.ts";
import { A2AAgentCardClient } from "../../src/discovery/connectors/a2a/client.ts";

test("discover_a2a_agent: tool handler returns successful result for valid A2A agent", async () => {
	const mockCard = {
		name: "SecurityAuditor",
		description: "Scans repository dependencies for CVEs",
		version: "1.2.0",
		supportedInterfaces: [
			{
				url: "https://agent.security.example.com/rpc",
				protocolBinding: "JSON-RPC",
				protocolVersion: "1.0",
			},
		],
		skills: [
			{
				id: "audit-cve",
				name: "CVE Audit",
				description: "Scans package.json",
				tags: ["security", "cve"],
			},
		],
	};

	const mockFetch = async (input: RequestInfo | URL) => {
		const url = input.toString();
		if (url === "https://agent.security.example.com/.well-known/agent-card.json") {
			return new Response(JSON.stringify(mockCard), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	const result = await handleDiscoverA2aAgent(
		{ agent_url: "https://agent.security.example.com" },
		client,
	);

	assert.equal(result.isError, undefined);
	assert.equal(result.content[0].type, "text");

	const parsed = JSON.parse(result.content[0].text);
	assert.equal(parsed.status, "discovered");
	assert.equal(parsed.agent.name, "SecurityAuditor");
	assert.equal(parsed.agent.version, "1.2.0");
	assert.equal(parsed.skills.length, 1);
	assert.equal(parsed.skills[0].name, "CVE Audit");
	assert.equal(parsed.profile.source.type, "a2a");
	assert.equal(parsed.profile.trust.status, "declared");
});

test("discover_a2a_agent: tool handler returns structured error on SSRF attempt", async () => {
	const client = new A2AAgentCardClient();

	const res1 = await handleDiscoverA2aAgent({ agent_url: "http://localhost:8080" }, client);
	assert.equal(res1.isError, true);
	assert.match(res1.content[0].text, /A2A Agent discovery failed/i);
	assert.match(res1.content[0].text, /HTTPS is required/i);

	const res2 = await handleDiscoverA2aAgent({ agent_url: "https://169.254.169.254" }, client);
	assert.equal(res2.isError, true);
	assert.match(res2.content[0].text, /A2A Agent discovery failed/i);
	assert.match(res2.content[0].text, /Discovery to private, loopback, or internal host/i);

	const res3 = await handleDiscoverA2aAgent(
		{ agent_url: "https://metadata.google.internal" },
		client,
	);
	assert.equal(res3.isError, true);
	assert.match(res3.content[0].text, /Discovery to private, loopback, or internal host/i);
});

test("discover_a2a_agent: tool handler returns structured error on HTTP 404 / 401 / 429", async () => {
	const mockFetch = async () => new Response("Not Found", { status: 404 });
	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });

	const res404 = await handleDiscoverA2aAgent({ agent_url: "https://agent.example.com" }, client);
	assert.equal(res404.isError, true);
	assert.match(res404.content[0].text, /Agent card not found/i);
});

test("discover_a2a_agent: tool handler returns structured error on malformed upstream JSON", async () => {
	const mockFetch = async () =>
		new Response("Not a JSON document", {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });

	const res = await handleDiscoverA2aAgent({ agent_url: "https://agent.example.com" }, client);
	assert.equal(res.isError, true);
	assert.match(res.content[0].text, /Failed to parse A2A Agent Card JSON/i);
});

test("discover_a2a_agent: schema validates agent_url length and format", () => {
	assert.doesNotThrow(() =>
		discoverA2aAgentInputSchema.parse({
			agent_url: "https://agent.example.com",
		}),
	);

	assert.throws(
		() => discoverA2aAgentInputSchema.parse({ agent_url: "" }),
		/Agent URL cannot be empty/i,
	);

	assert.throws(
		() =>
			discoverA2aAgentInputSchema.parse({
				agent_url: "https://" + "a".repeat(2050) + ".com",
			}),
		/must not exceed 2048 characters/i,
	);
});
