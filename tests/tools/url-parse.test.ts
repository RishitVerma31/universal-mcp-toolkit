import test from "node:test";
import assert from "node:assert/strict";
import {
	parseUrl,
	handleUrlParse,
	urlParseInputSchema,
} from "../../src/tools/developer/url-parse.ts";

test("url_parse: parses standard HTTPS URL correctly", () => {
	const parsed = parseUrl("https://example.com/api/v1/resource");
	assert.equal(parsed.protocol, "https:");
	assert.equal(parsed.hostname, "example.com");
	assert.equal(parsed.port, "");
	assert.equal(parsed.pathname, "/api/v1/resource");
	assert.equal(parsed.search, "");
	assert.equal(parsed.hash, "");
	assert.equal(parsed.origin, "https://example.com");
	assert.equal(parsed.username, "");
	assert.equal(parsed.isHttps, true);
});

test("url_parse: parses HTTP URL with custom port, query params, hash and username", () => {
	const parsed = parseUrl(
		"http://devuser:secret@localhost:8080/path/to/item?filter=active&sort=desc#top-section",
	);
	assert.equal(parsed.protocol, "http:");
	assert.equal(parsed.hostname, "localhost");
	assert.equal(parsed.port, "8080");
	assert.equal(parsed.pathname, "/path/to/item");
	assert.equal(parsed.search, "?filter=active&sort=desc");
	assert.equal(parsed.hash, "#top-section");
	assert.equal(parsed.origin, "http://localhost:8080");
	assert.equal(parsed.username, "devuser");
	assert.equal(parsed.isHttps, false);
});

test("url_parse: parses HTTPS URL with custom port", () => {
	const parsed = parseUrl("https://api.example.org:9443/status");
	assert.equal(parsed.protocol, "https:");
	assert.equal(parsed.hostname, "api.example.org");
	assert.equal(parsed.port, "9443");
	assert.equal(parsed.origin, "https://api.example.org:9443");
	assert.equal(parsed.isHttps, true);
});

test("url_parse: throws error for invalid URLs", () => {
	const invalidUrls = ["not a url", "://bad", "http://", "", "relative/path/only"];

	for (const invalid of invalidUrls) {
		assert.throws(
			() => parseUrl(invalid),
			/Invalid URL:/,
			`Should reject invalid URL: ${invalid}`,
		);
	}
});

test("url_parse: handler returns formatted JSON result for valid URL", async () => {
	const result = await handleUrlParse({ url: "https://cloudflare.com/docs" });
	assert.equal(result.isError, undefined);
	const data = JSON.parse(result.content[0].text);
	assert.equal(data.hostname, "cloudflare.com");
	assert.equal(data.isHttps, true);
	assert.equal(data.pathname, "/docs");
});

test("url_parse: handler returns error result for invalid URL", async () => {
	const result = await handleUrlParse({ url: "invalid-url" });
	assert.equal(result.isError, true);
	assert.match(result.content[0].text, /^Invalid URL:/);
});

test("url_parse: schema validation requires valid url string property", () => {
	const parsed = urlParseInputSchema.parse({
		url: "https://example.com",
	});
	assert.equal(parsed.url, "https://example.com");

	assert.throws(() => {
		urlParseInputSchema.parse({});
	});
});
