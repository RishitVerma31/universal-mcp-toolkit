import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.ts";

test("server: instantiates McpServer and registers all 8 toolkit tools", () => {
	const server = createServer();
	assert.ok(server, "Server should be defined");

	const expectedTools = [
		// 5 Developer Utilities (v0.1.0)
		"json_format",
		"base64_encode",
		"base64_decode",
		"hash_text",
		"url_parse",
		// 3 Agent Discovery Tools (v0.2.0)
		"search_mcp_registry",
		"get_mcp_server_details",
		"validate_agent_profile",
	];

	const registeredTools = (server as any)["_registeredTools"];
	assert.ok(registeredTools, "registered tools map should exist");

	for (const toolName of expectedTools) {
		assert.ok(toolName in registeredTools, `Tool '${toolName}' must be registered`);
	}

	assert.equal(
		Object.keys(registeredTools).length,
		8,
		"Server must register exactly eight tools",
	);

	// Verify original calculator tools remain completely removed
	assert.equal(
		"add" in registeredTools,
		false,
		"Old calculator 'add' tool must not be registered",
	);
	assert.equal(
		"calculate" in registeredTools,
		false,
		"Old calculator 'calculate' tool must not be registered",
	);
});
