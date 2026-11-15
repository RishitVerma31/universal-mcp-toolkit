import type { A2ADiscoveryResult } from "./types.ts";
import { safeParseA2aAgentCard } from "./agent-card-schema.ts";

export const DEFAULT_A2A_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_AGENT_CARD_BYTES = 1048576; // 1 MB
export const MAX_A2A_REDIRECTS = 3;

export interface A2AAgentCardClientOptions {
	fetchFn?: typeof fetch;
	timeoutMs?: number;
	maxSizeBytes?: number;
}

export function isPrivateIPv4(ip: string): boolean {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
		return false;
	}
	const [a, b, c] = parts;
	if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
	if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local, cloud metadata)
	if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
	if (a === 192 && b === 168) return true; // 192.168.0.0/16
	if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
	if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24 & 192.0.2.0/24
	if (a === 198 && (b === 18 || b === 19 || b === 51)) return true; // 198.18.0.0/15 & 198.51.100.0/24
	if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24
	if (a >= 224) return true; // multicast / reserved / broadcast (224.0.0.0/4)
	return false;
}

export function isPrivateIPv6(ip: string): boolean {
	let cleaned = ip.toLowerCase();
	if (cleaned.startsWith("[") && cleaned.endsWith("]")) {
		cleaned = cleaned.slice(1, -1);
	}
	if (
		cleaned === "::1" ||
		cleaned === "::" ||
		cleaned === "0:0:0:0:0:0:0:1" ||
		cleaned === "0:0:0:0:0:0:0:0"
	) {
		return true;
	}
	if (cleaned.startsWith("fc") || cleaned.startsWith("fd")) return true; // fc00::/7 (ULA)
	if (/^fe[89ab]/i.test(cleaned)) return true; // fe80::/10 (link-local)
	if (cleaned.startsWith("ff")) return true; // ff00::/8 multicast
	if (cleaned.startsWith("100::") || cleaned.startsWith("0100::")) return true; // 100::/64 discard
	if (cleaned.startsWith("64:ff9b::")) return true; // 64:ff9b::/96 NAT64
	if (cleaned.startsWith("2001:db8:") || cleaned.startsWith("2001:0db8:")) return true; // 2001:db8::/32 documentation
	if (cleaned.startsWith("2001:10:") || cleaned.startsWith("2001:20:")) return true; // ORCHID / ORCHIDv2
	if (cleaned.startsWith("2002:")) return true; // 2002::/16 6to4

	// IPv4-mapped IPv6 in dotted decimal: ::ffff:127.0.0.1 or 0:0:0:0:0:ffff:127.0.0.1
	const v4match = cleaned.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i);
	if (v4match) {
		return isPrivateIPv4(v4match[1]);
	}

	// IPv4-mapped IPv6 in hex: ::ffff:7f00:1
	const hexMatch = cleaned.match(/(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
	if (hexMatch) {
		const high = parseInt(hexMatch[1], 16);
		const low = parseInt(hexMatch[2], 16);
		const b1 = (high >> 8) & 0xff;
		const b2 = high & 0xff;
		const b3 = (low >> 8) & 0xff;
		const b4 = low & 0xff;
		return isPrivateIPv4(`${b1}.${b2}.${b3}.${b4}`);
	}

	return false;
}

export function isDisallowedHost(hostname: string): boolean {
	const h = hostname.toLowerCase().trim();

	if (h.includes("\\")) return true;
	if (h === "localhost" || h.endsWith(".localhost")) return true;
	if (
		h.endsWith(".local") ||
		h.endsWith(".internal") ||
		h.endsWith(".lan") ||
		h.endsWith(".home") ||
		h.endsWith(".corp") ||
		h.endsWith(".arpa")
	) {
		return true;
	}
	if (h === "metadata.google.internal" || h === "instance-data") return true;

	// Decimal or hex integer IP representations (e.g. 2130706433 or 0x7f000001)
	if (/^0x[0-9a-f]+$/i.test(h) || /^\d+$/.test(h)) return true;

	// Check if hostname is an IPv4 literal
	if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) {
		return isPrivateIPv4(h);
	}

	// Check if hostname is an IPv6 literal
	if (h.startsWith("[") || h.includes(":")) {
		return isPrivateIPv6(h);
	}

	// In public internet DNS, public HTTPS hosts have at least one dot (e.g. example.com).
	// Single-label hostnames without a dot are intranet / local machine names.
	if (!h.includes(".")) {
		return true;
	}

	return false;
}

export function validateA2aUrl(urlString: string): URL {
	if (!urlString || typeof urlString !== "string") {
		throw new Error("Agent URL must be a non-empty string.");
	}

	const trimmed = urlString.trim();

	if (trimmed.includes("\\")) {
		throw new Error("Security violation: Agent URL cannot contain backslashes.");
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new Error(`Invalid URL format: "${trimmed}"`);
	}

	if (parsed.protocol !== "https:") {
		throw new Error(
			`Security violation: HTTPS is required for A2A discovery. Received protocol: "${parsed.protocol}"`,
		);
	}

	if (parsed.username || parsed.password) {
		throw new Error("Security violation: Agent URL cannot contain embedded user credentials.");
	}

	if (parsed.port && parsed.port !== "443" && parsed.port !== "8443") {
		throw new Error(
			`Security violation: Non-standard HTTPS port "${parsed.port}" is not permitted for agent discovery.`,
		);
	}

	if (isDisallowedHost(parsed.hostname)) {
		throw new Error(
			`Security violation: Discovery to private, loopback, or internal host "${parsed.hostname}" is blocked.`,
		);
	}

	return parsed;
}

export function resolveCanonicalAgentCardUrl(target: string | URL): URL {
	const urlObj = typeof target === "string" ? new URL(target) : target;
	const pathname = urlObj.pathname;

	// If the user supplied a direct URL ending in .json or agent-card.json, use it directly
	if (pathname.endsWith("/agent-card.json") || pathname.endsWith(".json")) {
		return new URL(urlObj.toString());
	}

	// Otherwise append /.well-known/agent-card.json to the base origin/subpath
	const cleanPath = pathname.replace(/\/+$/, "");
	const newPath =
		cleanPath.length > 0
			? `${cleanPath}/.well-known/agent-card.json`
			: "/.well-known/agent-card.json";

	const resolved = new URL(urlObj.toString());
	resolved.pathname = newPath;
	resolved.search = "";
	resolved.hash = "";
	return resolved;
}

export async function readBoundedResponse(response: Response, maxBytes: number): Promise<string> {
	const contentLengthHeader = response.headers.get("content-length");
	if (contentLengthHeader) {
		const contentLength = parseInt(contentLengthHeader, 10);
		if (!isNaN(contentLength) && contentLength > maxBytes) {
			throw new Error(
				`Response size exceeds maximum allowed limit of ${maxBytes} bytes (Content-Length: ${contentLength}).`,
			);
		}
	}

	if (!response.body || typeof response.body.getReader !== "function") {
		const text = await response.text();
		if (text.length > maxBytes) {
			throw new Error(`Response body exceeded maximum allowed limit of ${maxBytes} bytes.`);
		}
		return text;
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value) {
				totalBytes += value.length;
				if (totalBytes > maxBytes) {
					await reader.cancel();
					throw new Error(
						`Response body stream exceeded maximum allowed limit of ${maxBytes} bytes.`,
					);
				}
				chunks.push(value);
			}
		}
	} catch (err) {
		if (err instanceof Error && err.message.includes("exceeded maximum allowed limit")) {
			throw err;
		}
		// If stream reading fails, rethrow
		throw err;
	}

	const concatenated = new Uint8Array(totalBytes);
	let offset = 0;
	for (const chunk of chunks) {
		concatenated.set(chunk, offset);
		offset += chunk.length;
	}

	return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(concatenated);
}

export class A2AAgentCardClient {
	private readonly fetchFn?: typeof fetch;
	private readonly timeoutMs: number;
	private readonly maxSizeBytes: number;

	constructor(options: A2AAgentCardClientOptions = {}) {
		this.fetchFn = options.fetchFn;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_A2A_TIMEOUT_MS;
		this.maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_AGENT_CARD_BYTES;
	}

	async fetchAgentCard(agentUrl: string): Promise<A2ADiscoveryResult> {
		const parsedTarget = validateA2aUrl(agentUrl);
		const canonicalDiscoveryUrl = resolveCanonicalAgentCardUrl(parsedTarget);
		const allowedOrigin = canonicalDiscoveryUrl.origin;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const fetcher = this.fetchFn || globalThis.fetch;
			let currentUrl = canonicalDiscoveryUrl.toString();
			let redirectCount = 0;
			let response: Response;

			while (true) {
				response = await fetcher(currentUrl, {
					method: "GET",
					headers: {
						Accept: "application/json, application/problem+json",
						"User-Agent": "universal-mcp-toolkit/0.3.0 (A2A Discovery)",
					},
					signal: controller.signal,
					redirect: "manual",
				});

				if (
					response.status === 301 ||
					response.status === 302 ||
					response.status === 307 ||
					response.status === 308
				) {
					redirectCount++;
					if (redirectCount > MAX_A2A_REDIRECTS) {
						throw new Error(
							`Too many redirects during A2A Agent Card discovery (exceeded max ${MAX_A2A_REDIRECTS}).`,
						);
					}

					const location = response.headers.get("location");
					if (!location) {
						throw new Error(
							`Redirect response (${response.status}) missing Location header.`,
						);
					}

					if (location.includes("\\") || location.startsWith("//")) {
						throw new Error(
							`Security violation: Redirect location contains unsafe characters: "${location}"`,
						);
					}

					const redirectUrl = new URL(location, currentUrl);

					if (redirectUrl.protocol !== "https:") {
						throw new Error(
							`Security violation: Redirect downgraded protocol to "${redirectUrl.protocol}". HTTPS required.`,
						);
					}

					if (redirectUrl.origin !== allowedOrigin) {
						throw new Error(
							`Security violation: Cross-origin redirect to "${redirectUrl.origin}" is blocked. A2A Agent Card must reside on same origin.`,
						);
					}

					// Validate port, credentials, and hostname on the redirect target
					validateA2aUrl(redirectUrl.toString());

					currentUrl = redirectUrl.toString();
					continue;
				}

				break;
			}

			// Validate final response.url origin if populated
			if (response.url) {
				const finalUrl = new URL(response.url);
				if (finalUrl.origin !== allowedOrigin) {
					throw new Error(
						`Security violation: Response origin mismatch (${finalUrl.origin} !== ${allowedOrigin}).`,
					);
				}
			}

			if (response.status === 404) {
				throw new Error(
					`A2A Agent Card not found at ${currentUrl} (HTTP 404). Ensure target publishes /.well-known/agent-card.json.`,
				);
			}

			if (response.status === 401 || response.status === 403) {
				throw new Error(
					`A2A Agent Card endpoint requires authentication (HTTP ${response.status}). Authenticated extended Agent Cards are not supported in v0.3.0.`,
				);
			}

			if (response.status === 429) {
				throw new Error(
					"Rate limit exceeded by target agent server (HTTP 429). Please retry later.",
				);
			}

			if (!response.ok) {
				throw new Error(
					`Target agent server responded with HTTP ${response.status} ${response.statusText}`,
				);
			}

			const contentType = (response.headers.get("content-type") || "").toLowerCase();
			if (
				!contentType.includes("application/json") &&
				!contentType.includes("application/problem+json") &&
				!contentType.includes("+json") &&
				!contentType.includes("text/json")
			) {
				throw new Error(
					`Invalid Content-Type from agent server (expected JSON, received "${contentType}").`,
				);
			}

			const rawBody = await readBoundedResponse(response, this.maxSizeBytes);

			let parsedJson: unknown;
			try {
				parsedJson = JSON.parse(rawBody);
			} catch (parseErr) {
				const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
				const error = new Error(`Failed to parse A2A Agent Card JSON: ${parseMsg}`);
				(error as any).cause = parseErr;
				throw error;
			}

			const validationResult = safeParseA2aAgentCard(parsedJson);
			if (!validationResult.success) {
				const errorDetails = validationResult.error.issues
					.map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
					.join("; ");
				throw new Error(`Invalid A2A Agent Card schema: ${errorDetails}`);
			}

			return {
				agentCardUrl: currentUrl,
				card: validationResult.data,
				resolvedBaseUrl: parsedTarget.origin,
			};
		} catch (err: unknown) {
			if (err instanceof Error) {
				if (err.name === "AbortError" || controller.signal.aborted) {
					const timeoutErr = new Error(
						`A2A Agent Card discovery request timed out after ${this.timeoutMs}ms.`,
					);
					(timeoutErr as any).cause = err;
					throw timeoutErr;
				}
				throw err;
			}
			const unexpectedErr = new Error(
				`Unexpected error during A2A discovery: ${String(err)}`,
			);
			(unexpectedErr as any).cause = err;
			throw unexpectedErr;
		} finally {
			clearTimeout(timer);
		}
	}
}
