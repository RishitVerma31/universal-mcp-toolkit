import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";
import { defaultDiscoveryEngine } from "../../discovery/search/discovery-engine.ts";
import type { DiscoveryEngine } from "../../discovery/search/discovery-engine.ts";

export const getMcpServerDetailsInputSchema = z.object({
	server_name: z
		.string()
		.min(1, "Server name cannot be empty")
		.max(300, "Server name must not exceed 300 characters")
		.describe(
			"Unique reverse-DNS identifier of the server in the registry (e.g. ac.inference.sh/mcp)",
		),
	version: z
		.string()
		.default("latest")
		.describe(
			"Semantic version string or 'latest' to retrieve the latest version manifest (default: latest)",
		),
});

export type GetMcpServerDetailsInput = z.input<typeof getMcpServerDetailsInputSchema>;

export async function handleGetMcpServerDetails(
	input: GetMcpServerDetailsInput,
	engine: DiscoveryEngine = defaultDiscoveryEngine,
) {
	try {
		const parsed = getMcpServerDetailsInputSchema.parse(input);
		const profile = await engine.getDetails(parsed.server_name, "mcp-registry", {
			version: parsed.version,
		});

		if (!profile) {
			return createErrorResult(
				`Server '${parsed.server_name}' (version: ${parsed.version}) was not found in the MCP Registry.`,
			);
		}

		return createTextResult(JSON.stringify(profile, null, 2));
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return createErrorResult(`Failed to retrieve MCP server details: ${message}`);
	}
}

export function registerGetMcpServerDetailsTool(
	server: McpServer,
	engine: DiscoveryEngine = defaultDiscoveryEngine,
): void {
	server.registerTool(
		"get_mcp_server_details",
		{
			description:
				"Retrieve detailed metadata for a specific MCP server from the official registry and return its normalized Universal Agent Profile.",
			inputSchema: getMcpServerDetailsInputSchema,
		},
		(args) => handleGetMcpServerDetails(args, engine),
	);
}
