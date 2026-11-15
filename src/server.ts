import { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "./tools/index.ts";

export function createServer(): McpServer {
	const server = new McpServer({
		name: "universal-mcp-toolkit",
		version: "0.3.0",
	});

	registerAllTools(server);

	return server;
}
