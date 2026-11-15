import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.ts";

test("server: instantiates McpServer and registers all 5 toolkit tools", () => {
	const server = createServer();
	assert.ok(server, "Server should be defined");

	// Inspect registered tools
	// McpServer stores registered tools in internal structures or via handlers
	const expectedTools = [
		"json_format",
		"base64_encode",
		"base64_decode",
		"hash_text",
		"url_parse",
	];

	// Verify internal registered tools map
	const registeredTools = (server as any)["_registeredTools"];
	assert.ok(registeredTools, "registered tools map should exist");

	for (const toolName of expectedTools) {
		assert.ok(toolName in registeredTools, `Tool '${toolName}' must be registered`);
	}

	// Verify original calculator tools are completely removed
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
