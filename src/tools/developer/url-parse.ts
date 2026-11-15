import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";

export const urlParseInputSchema = z.object({
	url: z.string().describe("The URL string to parse and inspect"),
});

export type UrlParseInput = z.infer<typeof urlParseInputSchema>;

export interface StructuredUrl {
	protocol: string;
	hostname: string;
	port: string;
	pathname: string;
	search: string;
	hash: string;
	origin: string;
	username: string;
	isHttps: boolean;
}

export function parseUrl(urlString: string): StructuredUrl {
	try {
		const parsed = new URL(urlString);
		return {
			protocol: parsed.protocol,
			hostname: parsed.hostname,
			port: parsed.port,
			pathname: parsed.pathname,
			search: parsed.search,
			hash: parsed.hash,
			origin: parsed.origin,
			username: parsed.username,
			isHttps: parsed.protocol === "https:",
		};
	} catch (err) {
		const error = new Error(`Invalid URL: ${err instanceof Error ? err.message : String(err)}`);
		(error as any).cause = err;
		throw error;
	}
}

export async function handleUrlParse({ url }: UrlParseInput) {
	try {
		const parsed = parseUrl(url);
		return createTextResult(JSON.stringify(parsed, null, 2));
	} catch (err) {
		return createErrorResult(err instanceof Error ? err.message : String(err));
	}
}

export function registerUrlParseTool(server: McpServer): void {
	server.registerTool(
		"url_parse",
		{
			description:
				"Parse and inspect a URL to return structured components (protocol, hostname, port, pathname, search, hash, origin, username, isHttps).",
			inputSchema: urlParseInputSchema,
		},
		handleUrlParse,
	);
}
