import type { McpRegistryDetailResponse, McpRegistryListResponse } from "./types.ts";

export interface McpRegistryClientOptions {
	baseUrl?: string;
	fetchFn?: typeof fetch;
	timeoutMs?: number;
}

export const OFFICIAL_MCP_REGISTRY_BASE_URL = "https://registry.modelcontextprotocol.io";
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export class McpRegistryClient {
	private readonly baseUrl: string;
	private readonly fetchFn?: typeof fetch;
	private readonly timeoutMs: number;

	constructor(options: McpRegistryClientOptions = {}) {
		const rawBase = (options.baseUrl || OFFICIAL_MCP_REGISTRY_BASE_URL).replace(/\/+$/, "");
		const parsed = new URL(rawBase);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			throw new Error(`Invalid MCP Registry baseUrl protocol: ${parsed.protocol}`);
		}
		this.baseUrl = rawBase;
		this.fetchFn = options.fetchFn;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
	}

	private async request<T>(path: string): Promise<T> {
		if (path.includes("\\")) {
			throw new Error(`Security violation: Invalid path containing backslash: ${path}`);
		}
		if (!path.startsWith("/")) {
			path = `/${path}`;
		}
		if (path.startsWith("//")) {
			throw new Error(
				`Security violation: Invalid path containing protocol-relative slash: ${path}`,
			);
		}

		const allowed = new URL(this.baseUrl);
		const targetUrl = new URL(path, this.baseUrl);
		if (targetUrl.origin !== allowed.origin) {
			throw new Error(
				`Security violation: MCP Registry client cannot request external origin ${targetUrl.origin}`,
			);
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const fetcher = this.fetchFn || globalThis.fetch;
			let currentUrl = targetUrl.toString();
			let redirectCount = 0;
			const maxRedirects = 3;
			let response: Response;

			while (true) {
				response = await fetcher(currentUrl, {
					method: "GET",
					headers: {
						Accept: "application/json",
						"User-Agent": "universal-mcp-toolkit/0.2.0",
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
					if (redirectCount > maxRedirects) {
						throw new Error("Too many redirects from MCP Registry (exceeded max 3)");
					}
					const location = response.headers.get("location");
					if (!location) {
						throw new Error(
							`Redirect response (${response.status}) missing Location header`,
						);
					}
					if (location.includes("\\") || location.startsWith("//")) {
						throw new Error(
							`Security violation: Redirect location contains unsafe characters: ${location}`,
						);
					}
					const redirectUrl = new URL(location, currentUrl);
					if (redirectUrl.origin !== allowed.origin) {
						throw new Error(
							`Security violation: MCP Registry redirect escaped allowed origin: ${redirectUrl.origin}`,
						);
					}
					if (redirectUrl.protocol !== allowed.protocol) {
						throw new Error(
							`Security violation: MCP Registry redirect changed protocol to ${redirectUrl.protocol}`,
						);
					}
					currentUrl = redirectUrl.toString();
					continue;
				}

				break;
			}

			if (response.url) {
				const responseUrl = new URL(response.url);
				if (responseUrl.origin !== allowed.origin) {
					throw new Error(
						`Security violation: MCP Registry response origin mismatch: ${responseUrl.origin}`,
					);
				}
			}

			if (response.status === 404) {
				const body = await response.json().catch(() => null);
				const error = new Error(`Resource not found on MCP Registry: ${path}`);
				(error as any).status = 404;
				(error as any).data = body;
				throw error;
			}

			if (response.status === 422) {
				const body = await response.json().catch(() => null);
				const detail = (body as any)?.detail || response.statusText;
				const error = new Error(`MCP Registry validation error (HTTP 422): ${detail}`);
				(error as any).status = 422;
				(error as any).data = body;
				throw error;
			}

			if (response.status === 429) {
				const error = new Error(
					"Rate limit exceeded by MCP Registry (HTTP 429). Please retry later.",
				);
				(error as any).status = 429;
				throw error;
			}

			if (!response.ok) {
				const error = new Error(
					`MCP Registry request failed with status ${response.status} ${response.statusText}`,
				);
				(error as any).status = response.status;
				throw error;
			}

			try {
				return (await response.json()) as T;
			} catch (parseError) {
				const jsonErr = new Error(
					`Invalid JSON response received from MCP Registry: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				);
				(jsonErr as any).cause = parseError;
				throw jsonErr;
			}
		} catch (err: unknown) {
			if (err instanceof Error) {
				if (err.name === "AbortError" || controller.signal.aborted) {
					const timeoutErr = new Error(
						`MCP Registry request timed out after ${this.timeoutMs}ms.`,
					);
					(timeoutErr as any).cause = err;
					throw timeoutErr;
				}
				throw err;
			}
			const unexpectedErr = new Error(
				`Unexpected error communicating with MCP Registry: ${String(err)}`,
			);
			(unexpectedErr as any).cause = err;
			throw unexpectedErr;
		} finally {
			clearTimeout(timer);
		}
	}

	async listServers(
		options: {
			search?: string;
			limit?: number;
			cursor?: string;
			version?: string;
		} = {},
	): Promise<McpRegistryListResponse> {
		const params = new URLSearchParams();
		if (options.search && options.search.trim().length > 0) {
			params.set("search", options.search.trim());
		}
		if (options.limit !== undefined) {
			const bounded = Math.max(1, Math.min(100, options.limit));
			params.set("limit", String(bounded));
		}
		if (options.cursor && options.cursor.trim().length > 0) {
			params.set("cursor", options.cursor.trim());
		}
		if (options.version && options.version.trim().length > 0) {
			params.set("version", options.version.trim());
		}

		const qs = params.toString();
		const path = `/v0.1/servers${qs ? `?${qs}` : ""}`;
		return this.request<McpRegistryListResponse>(path);
	}

	async getServerVersion(
		serverName: string,
		version = "latest",
	): Promise<McpRegistryDetailResponse | null> {
		const encodedName = encodeURIComponent(serverName.trim());
		const encodedVersion = encodeURIComponent(version.trim() || "latest");
		const path = `/v0.1/servers/${encodedName}/versions/${encodedVersion}`;

		try {
			return await this.request<McpRegistryDetailResponse>(path);
		} catch (err: any) {
			if (err?.status === 404) {
				return null;
			}
			throw err;
		}
	}
}
