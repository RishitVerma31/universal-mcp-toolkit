import type { McpServer } from "@modelcontextprotocol/server";
import { registerJsonFormatTool } from "./developer/json-format.ts";
import { registerBase64EncodeTool } from "./developer/base64-encode.ts";
import { registerBase64DecodeTool } from "./developer/base64-decode.ts";
import { registerHashTextTool } from "./developer/hash-text.ts";
import { registerUrlParseTool } from "./developer/url-parse.ts";
import { registerSearchMcpRegistryTool } from "./discovery/search-mcp-registry.ts";
import { registerGetMcpServerDetailsTool } from "./discovery/get-mcp-server-details.ts";
import { registerValidateAgentProfileTool } from "./discovery/validate-agent-profile.ts";
import { registerDiscoverA2aAgentTool } from "./discovery/discover-a2a-agent.ts";

export * from "./types.ts";

// Developer Tools
export {
	formatJson,
	jsonFormatInputSchema,
	handleJsonFormat,
	registerJsonFormatTool,
} from "./developer/json-format.ts";
export {
	base64Encode,
	base64EncodeInputSchema,
	handleBase64Encode,
	registerBase64EncodeTool,
} from "./developer/base64-encode.ts";
export {
	base64Decode,
	base64DecodeInputSchema,
	handleBase64Decode,
	registerBase64DecodeTool,
} from "./developer/base64-decode.ts";
export {
	hashText,
	hashAlgorithmSchema,
	hashTextInputSchema,
	handleHashText,
	registerHashTextTool,
} from "./developer/hash-text.ts";
export {
	parseUrl,
	urlParseInputSchema,
	handleUrlParse,
	registerUrlParseTool,
} from "./developer/url-parse.ts";

// Discovery Tools
export {
	searchMcpRegistryInputSchema,
	handleSearchMcpRegistry,
	registerSearchMcpRegistryTool,
} from "./discovery/search-mcp-registry.ts";
export {
	getMcpServerDetailsInputSchema,
	handleGetMcpServerDetails,
	registerGetMcpServerDetailsTool,
} from "./discovery/get-mcp-server-details.ts";
export {
	validateAgentProfileInputSchema,
	handleValidateAgentProfile,
	registerValidateAgentProfileTool,
} from "./discovery/validate-agent-profile.ts";
export {
	discoverA2aAgentInputSchema,
	handleDiscoverA2aAgent,
	registerDiscoverA2aAgentTool,
} from "./discovery/discover-a2a-agent.ts";

export function registerAllTools(server: McpServer): void {
	// 5 Developer Utilities (v0.1.0)
	registerJsonFormatTool(server);
	registerBase64EncodeTool(server);
	registerBase64DecodeTool(server);
	registerHashTextTool(server);
	registerUrlParseTool(server);

	// 3 Registry Discovery Tools (v0.2.0)
	registerSearchMcpRegistryTool(server);
	registerGetMcpServerDetailsTool(server);
	registerValidateAgentProfileTool(server);

	// 1 A2A Discovery Tool (v0.3.0)
	registerDiscoverA2aAgentTool(server);
}
