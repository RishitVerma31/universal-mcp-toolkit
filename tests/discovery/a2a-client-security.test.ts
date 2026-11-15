import test from "node:test";
import assert from "node:assert/strict";
import {
	A2AAgentCardClient,
	validateA2aUrl,
	resolveCanonicalAgentCardUrl,
	isPrivateIPv4,
	isPrivateIPv6,
	isDisallowedHost,
} from "../../src/discovery/connectors/a2a/client.ts";

test("A2A SSRF: URL validation enforces HTTPS and rejects non-HTTPS protocols", () => {
	assert.throws(() => validateA2aUrl("http://agent.example.com"), /HTTPS is required/i);
	assert.throws(() => validateA2aUrl("ftp://agent.example.com"), /HTTPS is required/i);
	assert.throws(() => validateA2aUrl("file:///etc/passwd"), /HTTPS is required/i);
	assert.throws(() => validateA2aUrl("javascript:alert(1)"), /HTTPS is required/i);
});

test("A2A SSRF: URL validation rejects embedded credentials", () => {
	assert.throws(
		() => validateA2aUrl("https://admin:password@agent.example.com"),
		/embedded user credentials/i,
	);
	assert.throws(
		() => validateA2aUrl("https://user@agent.example.com"),
		/embedded user credentials/i,
	);
});

test("A2A SSRF: URL validation restricts ports to 443 and 8443", () => {
	// Standard HTTPS ports are allowed
	assert.doesNotThrow(() => validateA2aUrl("https://agent.example.com"));
	assert.doesNotThrow(() => validateA2aUrl("https://agent.example.com:443"));
	assert.doesNotThrow(() => validateA2aUrl("https://agent.example.com:8443"));

	// Unsafe / internal ports are rejected
	assert.throws(() => validateA2aUrl("https://agent.example.com:80"), /Non-standard HTTPS port/i);
	assert.throws(
		() => validateA2aUrl("https://agent.example.com:8080"),
		/Non-standard HTTPS port/i,
	);
	assert.throws(() => validateA2aUrl("https://agent.example.com:22"), /Non-standard HTTPS port/i);
	assert.throws(
		() => validateA2aUrl("https://agent.example.com:3000"),
		/Non-standard HTTPS port/i,
	);
});

test("A2A SSRF: blocks private and loopback IPv4 addresses", () => {
	// Loopback (127.0.0.0/8)
	assert.equal(isPrivateIPv4("127.0.0.1"), true);
	assert.equal(isPrivateIPv4("127.1.2.3"), true);

	// Private Class A (10.0.0.0/8)
	assert.equal(isPrivateIPv4("10.0.0.1"), true);
	assert.equal(isPrivateIPv4("10.255.255.254"), true);

	// Private Class B (172.16.0.0/12)
	assert.equal(isPrivateIPv4("172.16.0.1"), true);
	assert.equal(isPrivateIPv4("172.31.255.254"), true);
	assert.equal(isPrivateIPv4("172.32.0.1"), false); // Public

	// Private Class C (192.168.0.0/16)
	assert.equal(isPrivateIPv4("192.168.0.1"), true);
	assert.equal(isPrivateIPv4("192.168.100.50"), true);

	// Cloud metadata / link-local (169.254.0.0/16)
	assert.equal(isPrivateIPv4("169.254.169.254"), true);
	assert.equal(isPrivateIPv4("169.254.1.1"), true);

	// Unspecified / broadcast / CGNAT / benchmark / multicast / reserved
	assert.equal(isPrivateIPv4("0.0.0.0"), true);
	assert.equal(isPrivateIPv4("100.64.0.1"), true);
	assert.equal(isPrivateIPv4("100.127.255.255"), true);
	assert.equal(isPrivateIPv4("198.18.0.1"), true);
	assert.equal(isPrivateIPv4("224.0.0.1"), true);
	assert.equal(isPrivateIPv4("240.0.0.1"), true);

	// Public routable IP
	assert.equal(isPrivateIPv4("8.8.8.8"), false);
	assert.equal(isPrivateIPv4("104.21.5.12"), false);

	// Validate with URL validator
	assert.throws(
		() => validateA2aUrl("https://127.0.0.1"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://169.254.169.254"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://10.0.0.5"),
		/Discovery to private, loopback, or internal host/i,
	);
});

test("A2A SSRF: blocks private, loopback, and multicast IPv6 addresses", () => {
	// Loopback
	assert.equal(isPrivateIPv6("::1"), true);
	assert.equal(isPrivateIPv6("0:0:0:0:0:0:0:1"), true);

	// Unique local (fc00::/7)
	assert.equal(isPrivateIPv6("fc00::1"), true);
	assert.equal(isPrivateIPv6("fd12:3456:789a::1"), true);

	// Link-local (fe80::/10)
	assert.equal(isPrivateIPv6("fe80::1"), true);
	assert.equal(isPrivateIPv6("febf::ffff"), true);

	// Multicast (ff00::/8)
	assert.equal(isPrivateIPv6("ff02::1"), true);

	// IPv4-mapped
	assert.equal(isPrivateIPv6("::ffff:127.0.0.1"), true);
	assert.equal(isPrivateIPv6("::ffff:7f00:1"), true);
	assert.equal(isPrivateIPv6("::ffff:10.0.0.1"), true);
	assert.equal(isPrivateIPv6("::ffff:192.168.1.1"), true);

	// NAT64, Documentation, ORCHID, Discard, and 6to4
	assert.equal(isPrivateIPv6("64:ff9b::1"), true);
	assert.equal(isPrivateIPv6("2001:db8::1"), true);
	assert.equal(isPrivateIPv6("2001:10::1"), true);
	assert.equal(isPrivateIPv6("2001:20::1"), true);
	assert.equal(isPrivateIPv6("100::1"), true);
	assert.equal(isPrivateIPv6("2002:c0a8:101::1"), true);

	// Validate with URL validator
	assert.throws(
		() => validateA2aUrl("https://[::1]"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://[fc00::1]"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://[fe80::1]"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://[::ffff:7f00:1]"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://[64:ff9b::1]"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://[2001:db8::1]"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://[2002:c0a8:101::1]"),
		/Discovery to private, loopback, or internal host/i,
	);
});

test("A2A SSRF: blocks internal, loopback, and metadata hostnames", () => {
	assert.equal(isDisallowedHost("localhost"), true);
	assert.equal(isDisallowedHost("sub.localhost"), true);
	assert.equal(isDisallowedHost("service.local"), true);
	assert.equal(isDisallowedHost("database.internal"), true);
	assert.equal(isDisallowedHost("intranet.corp"), true);
	assert.equal(isDisallowedHost("gateway.lan"), true);
	assert.equal(isDisallowedHost("metadata.google.internal"), true);
	assert.equal(isDisallowedHost("router"), true); // single label
	assert.equal(isDisallowedHost("intranet"), true); // single label

	// Allowed public domain names
	assert.equal(isDisallowedHost("agent.example.com"), false);
	assert.equal(isDisallowedHost("ai.google.dev"), false);

	// Validate with URL validator
	assert.throws(
		() => validateA2aUrl("https://localhost"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://metadata.google.internal"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://api.internal"),
		/Discovery to private, loopback, or internal host/i,
	);
	assert.throws(
		() => validateA2aUrl("https://router"),
		/Discovery to private, loopback, or internal host/i,
	);
});

test("A2A URL resolution: resolves canonical .well-known/agent-card.json path", () => {
	// Base URL without trailing slash
	assert.equal(
		resolveCanonicalAgentCardUrl("https://agent.example.com").toString(),
		"https://agent.example.com/.well-known/agent-card.json",
	);

	// Base URL with trailing slash
	assert.equal(
		resolveCanonicalAgentCardUrl("https://agent.example.com/").toString(),
		"https://agent.example.com/.well-known/agent-card.json",
	);

	// Already canonical agent-card.json
	assert.equal(
		resolveCanonicalAgentCardUrl(
			"https://agent.example.com/.well-known/agent-card.json",
		).toString(),
		"https://agent.example.com/.well-known/agent-card.json",
	);

	// Prefixed path (e.g., versioned endpoint or reverse proxy subpath)
	assert.equal(
		resolveCanonicalAgentCardUrl("https://agent.example.com/v1").toString(),
		"https://agent.example.com/v1/.well-known/agent-card.json",
	);
	assert.equal(
		resolveCanonicalAgentCardUrl("https://agent.example.com/v1/").toString(),
		"https://agent.example.com/v1/.well-known/agent-card.json",
	);
});

test("A2A Client: successfully fetches and validates agent card with mock fetch", async () => {
	const validCard = {
		name: "VerifiedAgent",
		description: "A production agent card",
		version: "1.0.0",
		supportedInterfaces: [
			{
				url: "https://agent.example.com/rpc",
				protocolBinding: "JSON-RPC",
				protocolVersion: "1.0",
			},
		],
		skills: [{ name: "search", description: "Search the web" }],
	};

	const mockFetch = async (input: RequestInfo | URL) => {
		const url = input.toString();
		if (url === "https://agent.example.com/.well-known/agent-card.json") {
			return new Response(JSON.stringify(validCard), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	const result = await client.fetchAgentCard("https://agent.example.com");

	assert.equal(result.card.name, "VerifiedAgent");
	assert.equal(result.agentCardUrl, "https://agent.example.com/.well-known/agent-card.json");
	assert.equal(result.card.skills?.[0].name, "search");
});

test("A2A Client: follows same-origin redirects up to limit", async () => {
	let hopCount = 0;
	const mockFetch = async (input: RequestInfo | URL) => {
		const url = input.toString();
		if (url === "https://agent.example.com/.well-known/agent-card.json") {
			hopCount++;
			return new Response(null, {
				status: 302,
				headers: { Location: "https://agent.example.com/redirected/agent-card.json" },
			});
		}
		if (url === "https://agent.example.com/redirected/agent-card.json") {
			hopCount++;
			return new Response(
				JSON.stringify({
					name: "RedirectedAgent",
					supportedInterfaces: [
						{
							url: "https://agent.example.com/redirected/rpc",
							protocolBinding: "JSON-RPC",
							protocolVersion: "1.0",
						},
					],
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	const result = await client.fetchAgentCard("https://agent.example.com");

	assert.equal(hopCount, 2);
	assert.equal(result.card.name, "RedirectedAgent");
	assert.equal(result.agentCardUrl, "https://agent.example.com/redirected/agent-card.json");
});

test("A2A Client: blocks cross-origin redirects", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const url = input.toString();
		if (url === "https://agent.example.com/.well-known/agent-card.json") {
			return new Response(null, {
				status: 301,
				headers: { Location: "https://malicious.example.com/agent-card.json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.fetchAgentCard("https://agent.example.com"),
		/Cross-origin redirect.*is blocked/i,
	);
});

test("A2A Client: blocks protocol-downgrade redirects", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const url = input.toString();
		if (url === "https://agent.example.com/.well-known/agent-card.json") {
			return new Response(null, {
				status: 302,
				headers: { Location: "http://agent.example.com/insecure-card.json" },
			});
		}
		return new Response("Not Found", { status: 404 });
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.fetchAgentCard("https://agent.example.com"),
		/Redirect downgraded protocol/i,
	);
});

test("A2A Client: enforces maximum redirect depth", async () => {
	const mockFetch = async (input: RequestInfo | URL) => {
		const url = input.toString();
		const match = url.match(/step-(\d+)/);
		const step = match ? parseInt(match[1], 10) : 0;
		return new Response(null, {
			status: 302,
			headers: { Location: `https://agent.example.com/step-${step + 1}` },
		});
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.fetchAgentCard("https://agent.example.com/step-0"),
		/Too many redirects/i,
	);
});

test("A2A Client: rejects responses with non-JSON Content-Type", async () => {
	const mockFetch = async () => {
		return new Response("<html><body>Login Page</body></html>", {
			status: 200,
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.fetchAgentCard("https://agent.example.com"),
		/Invalid Content-Type/i,
	);
});

test("A2A Client: rejects oversized responses exceeding 1 MB limit", async () => {
	const mockFetch = async () => {
		// Create a large body (> 1 MB)
		const oversizedChunk = "a".repeat(1024 * 1024 + 100);
		return new Response(oversizedChunk, {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	};

	const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
	await assert.rejects(
		() => client.fetchAgentCard("https://agent.example.com"),
		/exceeded maximum allowed limit/i,
	);
});

test("A2A Client: surfaces HTTP error statuses clearly", async () => {
	const testStatus = async (status: number, pattern: RegExp) => {
		const mockFetch = async () => new Response("Error message", { status });
		const client = new A2AAgentCardClient({ fetchFn: mockFetch as typeof fetch });
		await assert.rejects(() => client.fetchAgentCard("https://agent.example.com"), pattern);
	};

	await testStatus(404, /Agent card not found/i);
	await testStatus(401, /requires authentication \(HTTP 401\)/i);
	await testStatus(403, /requires authentication|authorization error \(HTTP 403\)/i);
	await testStatus(429, /Rate limit exceeded/i);
	await testStatus(500, /HTTP 500/i);
});
