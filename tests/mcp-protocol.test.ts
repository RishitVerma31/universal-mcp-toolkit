import test from "node:test";
import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import worker from "../src/index.ts";

function createTestTransport() {
	return new StreamableHTTPClientTransport(new URL("http://localhost:8787/mcp"), {
		fetch: async (url, init) => {
			const headers = new Headers(init?.headers);
			if (!headers.has("Host")) {
				headers.set("Host", "localhost:8787");
			}
			const req = new Request(url, { ...init, headers });
			return await worker.fetch(req, {}, {} as ExecutionContext);
		},
	});
}

function getTextContent(res: { content?: Array<{ type: string; text?: string }> }): string {
	assert.ok(res.content && res.content.length > 0, "Response should have content");
	const block = res.content[0];
	assert.equal(block.type, "text", "Content block should be text");
	assert.ok(typeof block.text === "string", "Content text should be a string");
	return block.text;
}

test("mcp protocol e2e: connects, initializes, and lists exactly 5 tools", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	const toolsList = await client.listTools();
	assert.equal(toolsList.tools.length, 5);

	const toolNames = toolsList.tools.map((t) => t.name);
	const expectedTools = [
		"json_format",
		"base64_encode",
		"base64_decode",
		"hash_text",
		"url_parse",
	];

	for (const expected of expectedTools) {
		assert.ok(toolNames.includes(expected), `Expected tool '${expected}' to be present`);
	}

	assert.equal(toolNames.includes("add"), false, "Calculator 'add' must be absent");
	assert.equal(toolNames.includes("calculate"), false, "Calculator 'calculate' must be absent");

	await client.close();
});

test("mcp protocol e2e: invokes all 5 tools successfully through protocol", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	// 1. json_format
	const resJson = await client.callTool({
		name: "json_format",
		arguments: { json: '{"name":"Jarvis","active":true}' },
	});
	assert.equal(resJson.isError, undefined);
	assert.equal(getTextContent(resJson as any), '{\n  "name": "Jarvis",\n  "active": true\n}');

	// 2. base64_encode
	const resB64Enc = await client.callTool({
		name: "base64_encode",
		arguments: { text: "Hello 🌍" },
	});
	assert.equal(resB64Enc.isError, undefined);
	assert.equal(getTextContent(resB64Enc as any), "SGVsbG8g8J+MjQ==");

	// 3. base64_decode
	const resB64Dec = await client.callTool({
		name: "base64_decode",
		arguments: { encoded: "SGVsbG8g8J+MjQ==" },
	});
	assert.equal(resB64Dec.isError, undefined);
	assert.equal(getTextContent(resB64Dec as any), "Hello 🌍");

	// 4. hash_text
	const resHash = await client.callTool({
		name: "hash_text",
		arguments: { text: "hello world", algorithm: "SHA-256" },
	});
	assert.equal(resHash.isError, undefined);
	assert.equal(
		getTextContent(resHash as any),
		"b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
	);

	// 5. url_parse
	const resUrl = await client.callTool({
		name: "url_parse",
		arguments: { url: "https://example.com:8080/path?name=test#section" },
	});
	assert.equal(resUrl.isError, undefined);
	const parsed = JSON.parse(getTextContent(resUrl as any));
	assert.equal(parsed.protocol, "https:");
	assert.equal(parsed.hostname, "example.com");
	assert.equal(parsed.port, "8080");
	assert.equal(parsed.pathname, "/path");
	assert.equal(parsed.search, "?name=test");
	assert.equal(parsed.hash, "#section");
	assert.equal(parsed.isHttps, true);

	await client.close();
});

test("mcp protocol e2e: error handling returns isError=true without crashing", async () => {
	const transport = createTestTransport();
	const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

	await client.connect(transport);

	// Invalid JSON
	const errJson = await client.callTool({
		name: "json_format",
		arguments: { json: '{"name":"Jarvis","active"}' },
	});
	assert.equal(errJson.isError, true);
	assert.match(getTextContent(errJson as any), /Invalid JSON:/);

	// Invalid Base64
	const errB64 = await client.callTool({
		name: "base64_decode",
		arguments: { encoded: "invalid-base64!@#" },
	});
	assert.equal(errB64.isError, true);
	assert.match(getTextContent(errB64 as any), /Invalid Base64 string/);

	// Unsupported Hash Algorithm
	const errHash = await client.callTool({
		name: "hash_text",
		arguments: { text: "data", algorithm: "MD5" },
	});
	assert.equal(errHash.isError, true);
	assert.match(getTextContent(errHash as any), /Input validation error/);

	// Invalid URL
	const errUrl = await client.callTool({
		name: "url_parse",
		arguments: { url: "invalid-url" },
	});
	assert.equal(errUrl.isError, true);
	assert.match(getTextContent(errUrl as any), /Invalid URL/);

	// Missing parameter
	const errMissing = await client.callTool({
		name: "base64_encode",
		arguments: {},
	});
	assert.equal(errMissing.isError, true);
	assert.match(getTextContent(errMissing as any), /Input validation error/);

	await client.close();
});
