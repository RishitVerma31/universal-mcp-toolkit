import type {
	GitHubClientOptions,
	GitHubRateLimitInfo,
	GitHubReadmeResponse,
	GitHubRepository,
	GitHubSearchOptions,
	GitHubSearchRepositoriesResponse,
} from "./types.ts";
import {
	gitHubReadmeResponseSchema,
	gitHubRepositorySchema,
	gitHubSearchRepositoriesResponseSchema,
} from "./github-repository-schema.ts";

export const OFFICIAL_GITHUB_API_BASE_URL = "https://api.github.com";
export const DEFAULT_GITHUB_TIMEOUT_MS = 8000;
export const DEFAULT_MAX_GITHUB_RESPONSE_BYTES = 1048576; // 1 MB
export const DEFAULT_MAX_README_DECODED_CHARS = 32768; // 32 KB text window
export const MAX_GITHUB_REDIRECTS = 3;

export function extractGitHubRateLimit(headers: Headers): GitHubRateLimitInfo {
	const limitHeader = headers.get("x-ratelimit-limit");
	const remainingHeader = headers.get("x-ratelimit-remaining");
	const resetHeader = headers.get("x-ratelimit-reset");
	const usedHeader = headers.get("x-ratelimit-used");

	const limit = limitHeader ? parseInt(limitHeader, 10) : undefined;
	const remaining = remainingHeader ? parseInt(remainingHeader, 10) : undefined;
	const used = usedHeader ? parseInt(usedHeader, 10) : undefined;

	let reset: string | undefined = undefined;
	if (resetHeader) {
		const seconds = parseInt(resetHeader, 10);
		if (!isNaN(seconds) && seconds > 0) {
			reset = new Date(seconds * 1000).toISOString();
		}
	}

	return {
		limit: isNaN(limit as number) ? undefined : limit,
		remaining: isNaN(remaining as number) ? undefined : remaining,
		reset,
		used: isNaN(used as number) ? undefined : used,
	};
}

export function validateGitHubIdentifier(identifier: string, fieldName = "identifier"): void {
	if (!identifier || typeof identifier !== "string") {
		throw new Error(`${fieldName} must be a non-empty string.`);
	}
	const trimmed = identifier.trim();
	if (trimmed === "." || trimmed === "..") {
		throw new Error(
			`Security violation: ${fieldName} cannot be dot navigation: '${identifier}'`,
		);
	}
	if (trimmed.includes("/") || trimmed.includes("\\")) {
		throw new Error(
			`Security violation: ${fieldName} cannot contain path separators: '${identifier}'`,
		);
	}
	const validPattern = /^[a-zA-Z0-9_.-]{1,100}$/;
	if (!validPattern.test(trimmed)) {
		throw new Error(
			`Invalid ${fieldName}: '${identifier}'. Must contain only alphanumeric characters, underscores, hyphens, or dots (1-100 characters).`,
		);
	}
}

export class GitHubClient {
	private readonly baseUrl: string;
	private readonly fetchFn?: typeof fetch;
	private readonly timeoutMs: number;
	private readonly userAgent: string;
	private readonly maxResponseBytes: number;

	constructor(options: GitHubClientOptions = {}) {
		const rawBase = (options.baseUrl || OFFICIAL_GITHUB_API_BASE_URL).replace(/\/+$/, "");
		const parsed = new URL(rawBase);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			throw new Error(`Invalid GitHub API baseUrl protocol: ${parsed.protocol}`);
		}
		this.baseUrl = rawBase;
		this.fetchFn = options.fetchFn;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_GITHUB_TIMEOUT_MS;
		this.userAgent = options.userAgent || "universal-mcp-toolkit/0.4.0";
		this.maxResponseBytes = DEFAULT_MAX_GITHUB_RESPONSE_BYTES;
	}

	private async request<T>(path: string): Promise<{ data: T; rateLimit: GitHubRateLimitInfo }> {
		if (path.includes("\\")) {
			throw new Error(`Security violation: Invalid path containing backslash: ${path}`);
		}
		if (path.startsWith("//")) {
			throw new Error(
				`Security violation: Invalid path containing protocol-relative slash: ${path}`,
			);
		}

		const allowed = new URL(this.baseUrl);
		if (path.startsWith("http://") || path.startsWith("https://")) {
			const directUrl = new URL(path);
			if (directUrl.origin !== allowed.origin) {
				throw new Error(
					`Security violation: GitHub client cannot request external origin ${directUrl.origin}`,
				);
			}
		}

		if (!path.startsWith("/")) {
			path = `/${path}`;
		}

		const targetUrl = new URL(path, this.baseUrl);
		if (targetUrl.origin !== allowed.origin) {
			throw new Error(
				`Security violation: GitHub client cannot request external origin ${targetUrl.origin}`,
			);
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const fetcher = this.fetchFn || globalThis.fetch;
			let currentUrl = targetUrl.toString();
			let redirectCount = 0;
			let response: Response;

			while (true) {
				response = await fetcher(currentUrl, {
					method: "GET",
					headers: {
						Accept: "application/vnd.github.v3+json",
						"User-Agent": this.userAgent,
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
					if (redirectCount > MAX_GITHUB_REDIRECTS) {
						throw new Error("Too many redirects from GitHub API (exceeded max 3)");
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
							`Security violation: GitHub redirect escaped allowed origin: ${redirectUrl.origin}`,
						);
					}
					if (redirectUrl.protocol !== allowed.protocol) {
						throw new Error(
							`Security violation: GitHub redirect changed protocol to ${redirectUrl.protocol}`,
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
						`Security violation: GitHub response origin mismatch: ${responseUrl.origin}`,
					);
				}
			}

			const rateLimit = extractGitHubRateLimit(response.headers);

			// Check Content-Length if present
			const clHeader = response.headers.get("content-length");
			if (clHeader) {
				const cl = parseInt(clHeader, 10);
				if (!isNaN(cl) && cl > this.maxResponseBytes) {
					throw new Error(
						`GitHub API response exceeded maximum allowed limit of ${this.maxResponseBytes} bytes (Content-Length: ${cl})`,
					);
				}
			}

			if (response.status === 403) {
				const body = await response.json().catch(() => null);
				const isRateLimit =
					rateLimit.remaining === 0 ||
					(typeof (body as any)?.message === "string" &&
						(body as any).message.toLowerCase().includes("rate limit"));

				if (isRateLimit) {
					const resetMsg = rateLimit.reset ? ` Resets at ${rateLimit.reset}.` : "";
					const error = new Error(
						`GitHub API rate limit exceeded (HTTP 403). Remaining: ${rateLimit.remaining ?? 0}.${resetMsg}`,
					);
					(error as any).status = 403;
					(error as any).rateLimit = rateLimit;
					(error as any).data = body;
					throw error;
				}

				const forbiddenMsg = (body as any)?.message || response.statusText;
				const error = new Error(`GitHub API access forbidden (HTTP 403): ${forbiddenMsg}`);
				(error as any).status = 403;
				(error as any).rateLimit = rateLimit;
				(error as any).data = body;
				throw error;
			}

			if (response.status === 429) {
				const error = new Error(
					"GitHub API rate limit / secondary rate limit triggered (HTTP 429). Please retry later.",
				);
				(error as any).status = 429;
				(error as any).rateLimit = rateLimit;
				throw error;
			}

			if (response.status === 404) {
				const body = await response.json().catch(() => null);
				const error = new Error(`Resource not found on GitHub: ${path}`);
				(error as any).status = 404;
				(error as any).rateLimit = rateLimit;
				(error as any).data = body;
				throw error;
			}

			if (!response.ok) {
				const body = await response.json().catch(() => null);
				const message = (body as any)?.message || response.statusText;
				const error = new Error(
					`GitHub API request failed with status ${response.status}: ${message}`,
				);
				(error as any).status = response.status;
				(error as any).rateLimit = rateLimit;
				(error as any).data = body;
				throw error;
			}

			// Bounded body read
			const rawText = await response.text();
			if (rawText.length > this.maxResponseBytes) {
				throw new Error(
					`GitHub API response body exceeded maximum allowed limit of ${this.maxResponseBytes} bytes.`,
				);
			}

			try {
				const parsedJson = JSON.parse(rawText) as T;
				return { data: parsedJson, rateLimit };
			} catch (parseError) {
				const jsonErr = new Error(
					`Invalid JSON response received from GitHub: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				);
				(jsonErr as any).cause = parseError;
				throw jsonErr;
			}
		} catch (err: unknown) {
			if (err instanceof Error) {
				if (err.name === "AbortError" || controller.signal.aborted) {
					const timeoutErr = new Error(
						`GitHub API request timed out after ${this.timeoutMs}ms.`,
					);
					(timeoutErr as any).cause = err;
					throw timeoutErr;
				}
				throw err;
			}
			const unexpectedErr = new Error(
				`Unexpected error communicating with GitHub API: ${String(err)}`,
			);
			(unexpectedErr as any).cause = err;
			throw unexpectedErr;
		} finally {
			clearTimeout(timer);
		}
	}

	async searchRepositories(
		options: GitHubSearchOptions,
	): Promise<{ data: GitHubSearchRepositoriesResponse; rateLimit: GitHubRateLimitInfo }> {
		const trimmedQuery = (options.query || "").trim();
		if (!trimmedQuery) {
			throw new Error("GitHub repository search query cannot be empty.");
		}

		const params = new URLSearchParams();
		params.set("q", trimmedQuery);

		if (options.sort) {
			params.set("sort", options.sort);
		}
		if (options.order) {
			params.set("order", options.order);
		}
		if (options.perPage !== undefined) {
			const bounded = Math.max(1, Math.min(100, options.perPage));
			params.set("per_page", String(bounded));
		}
		if (options.page !== undefined) {
			const bounded = Math.max(1, options.page);
			params.set("page", String(bounded));
		}

		const path = `/search/repositories?${params.toString()}`;
		const result = await this.request<unknown>(path);
		const validated = gitHubSearchRepositoriesResponseSchema.parse(result.data);

		return { data: validated, rateLimit: result.rateLimit };
	}

	async getRepository(
		owner: string,
		repo: string,
	): Promise<{ data: GitHubRepository; rateLimit: GitHubRateLimitInfo } | null> {
		validateGitHubIdentifier(owner, "owner");
		validateGitHubIdentifier(repo, "repo");

		const path = `/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(repo.trim())}`;
		try {
			const result = await this.request<unknown>(path);
			const validated = gitHubRepositorySchema.parse(result.data);
			return { data: validated, rateLimit: result.rateLimit };
		} catch (err: any) {
			if (err?.status === 404) {
				return null;
			}
			throw err;
		}
	}

	async getReadme(
		owner: string,
		repo: string,
	): Promise<{ data: GitHubReadmeResponse; rateLimit: GitHubRateLimitInfo } | null> {
		validateGitHubIdentifier(owner, "owner");
		validateGitHubIdentifier(repo, "repo");

		const path = `/repos/${encodeURIComponent(owner.trim())}/${encodeURIComponent(repo.trim())}/readme`;
		try {
			const result = await this.request<unknown>(path);
			const validated = gitHubReadmeResponseSchema.parse(result.data);
			return { data: validated, rateLimit: result.rateLimit };
		} catch (err: any) {
			if (err?.status === 404) {
				return null;
			}
			throw err;
		}
	}

	async fetchAndDecodeReadme(
		owner: string,
		repo: string,
		maxDecodedChars = DEFAULT_MAX_README_DECODED_CHARS,
	): Promise<{ content: string; name: string; size: number } | null> {
		const readmeResult = await this.getReadme(owner, repo);
		if (!readmeResult) {
			return null;
		}

		const { content, encoding, name, size } = readmeResult.data;
		if (encoding !== "base64" || !content) {
			return { content: "", name, size };
		}

		try {
			const cleanB64 = content.replace(/\s+/g, "");
			const binary = atob(cleanB64);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			const decoded = new TextDecoder("utf-8").decode(bytes);
			const bounded = decoded.slice(0, maxDecodedChars);

			return { content: bounded, name, size };
		} catch (_decodeErr) {
			// Handle invalid Base64 gracefully without failing whole inspection
			return { content: "", name, size };
		}
	}
}
