import test from "node:test";
import assert from "node:assert/strict";
import { A2AAgentCardConnector } from "../../src/discovery/connectors/a2a/connector.ts";
import { A2AAgentCardClient } from "../../src/discovery/connectors/a2a/client.ts";
import { DiscoveryEngine } from "../../src/discovery/search/discovery-engine.ts";

test("A2AAgentCardConnector: retrieves details by URL and handles search queries", async () => {
	const mockCard = {
		name: "ConnectorAgent",
		description: "Agent discovered through connector",
		version: "1.0.0",
		supportedInterfaces: [
			{
				url: "https://agent.example.com/api",
				protocolBinding: "JSON-RPC",
				protocolVersion: "1.0",
			},
		],
		skills: [{ name: "code-gen", tags: ["coding"] }],
	};

	const mockFetch = async (input: RequestInfo | URL) => {
		const url = input.toString();
		if (url === "https://agent.example.com/.well-known/agent-card.json") {
			return new Response(JSON.stringify(mockCard), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	const connector = new A2AAgentCardConnector(client);

	assert.equal(connector.id, "a2a");
	assert.equal(connector.name, "A2A Protocol Agent Card Discovery");

	// 1. getDetails
	const details = await connector.getDetails("https://agent.example.com");
	assert.ok(details);
	assert.equal(details?.name, "ConnectorAgent");
	assert.equal(details?.source.type, "a2a");
	assert.equal(details?.trust.status, "declared");

	// 2. getDetails with 404 URL returns null
	const notFound = await connector.getDetails("https://nonexistent.example.com");
	assert.equal(notFound, null);

	// 3. search with matching agent URL
	const searchResult = await connector.search({ query: "https://agent.example.com" });
	assert.equal(searchResult.profiles.length, 1);
	assert.equal(searchResult.profiles[0].name, "ConnectorAgent");

	// 4. search with non-URL query (returns empty list cleanly)
	const nonUrlResult = await connector.search({ query: "keyword-search" });
	assert.equal(nonUrlResult.profiles.length, 0);
});

test("DiscoveryEngine: operates with both default connectors registered", async () => {
	const engine = new DiscoveryEngine();
	const connectors = engine.listConnectors();
	assert.equal(connectors.length, 2);
	assert.equal(connectors[0].id, "mcp-registry");
	assert.equal(connectors[1].id, "a2a");
});
