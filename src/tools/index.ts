import type { McpServer } from "@modelcontextprotocol/server";
import { registerJsonFormatTool } from "./developer/json-format.ts";
import { registerBase64EncodeTool } from "./developer/base64-encode.ts";
import { registerBase64DecodeTool } from "./developer/base64-decode.ts";
import { registerHashTextTool } from "./developer/hash-text.ts";
import { registerUrlParseTool } from "./developer/url-parse.ts";

export * from "./types.ts";
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

export function registerAllTools(server: McpServer): void {
	registerJsonFormatTool(server);
	registerBase64EncodeTool(server);
	registerBase64DecodeTool(server);
	registerHashTextTool(server);
	registerUrlParseTool(server);
}
