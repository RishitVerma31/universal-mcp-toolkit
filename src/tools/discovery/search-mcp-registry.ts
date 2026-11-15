import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";
import { defaultDiscoveryEngine } from "../../discovery/search/discovery-engine.ts";
import type { DiscoveryEngine } from "../../discovery/search/discovery-engine.ts";

export const searchMcpRegistryInputSchema = z.object({
	query: z
		.string()
		.trim()
		.min(
			3,
			"Search query must contain at least 3 characters after trimming surrounding whitespace",
		)
		.max(200, "Search query must not exceed 200 characters")
		.describe(
			"Keyword or substring to search published MCP servers in the official registry (minimum 3 characters)",
		),
	limit: z
		.number()
		.int("Limit must be an integer")
		.min(1, "Limit must be at least 1")
		.max(100, "Limit cannot exceed 100")
		.default(20)
		.describe("Maximum number of server profiles to return (1-100, default: 20)"),
	cursor: z
		.string()
		.optional()
		.describe("Opaque pagination cursor returned from a previous search request"),
	latest_only: z
		.boolean()
		.default(true)
		.describe("Whether to return only the latest version of each server (default: true)"),
});

export type SearchMcpRegistryInput = z.input<typeof searchMcpRegistryInputSchema>;

export async function handleSearchMcpRegistry(
	input: SearchMcpRegistryInput,
	engine: DiscoveryEngine = defaultDiscoveryEngine,
) {
	try {
		const parsed = searchMcpRegistryInputSchema.parse(input);
		const result = await engine.search(
			{
				query: parsed.query,
				limit: parsed.limit,
				cursor: parsed.cursor,
				latestOnly: parsed.latest_only,
			},
			"mcp-registry",
		);

		const responsePayload = {
			query: parsed.query,
			latestOnly: parsed.latest_only,
			count: result.profiles.length,
			nextCursor: result.nextCursor,
			source: result.source,
			profiles: result.profiles,
		};

		return createTextResult(JSON.stringify(responsePayload, null, 2));
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return createErrorResult(`MCP Registry search failed: ${message}`);
	}
}

export function registerSearchMcpRegistryTool(
	server: McpServer,
	engine: DiscoveryEngine = defaultDiscoveryEngine,
): void {
	server.registerTool(
		"search_mcp_registry",
		{
			description:
				"Search the official Model Context Protocol (MCP) Registry for servers matching a query, returning normalized Universal Agent Profiles and pagination metadata.",
			inputSchema: searchMcpRegistryInputSchema,
		},
		(args) => handleSearchMcpRegistry(args, engine),
	);
}
