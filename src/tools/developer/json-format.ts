import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";

export const jsonFormatInputSchema = z.object({
	json: z.string().describe("The JSON string to format and validate"),
	indent: z
		.number()
		.int("Indentation must be an integer")
		.min(0, "Indentation must be at least 0")
		.max(8, "Indentation cannot exceed 8")
		.default(2)
		.describe("Indentation spaces (0-8, default: 2)"),
});

export type JsonFormatInput = z.infer<typeof jsonFormatInputSchema>;

export function formatJson(jsonString: string, indent: number = 2): string {
	const parsed = JSON.parse(jsonString);
	return JSON.stringify(parsed, null, indent);
}

export async function handleJsonFormat({ json, indent }: JsonFormatInput) {
	try {
		const formatted = formatJson(json, indent);
		return createTextResult(formatted);
	} catch (err) {
		return createErrorResult(
			`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

export function registerJsonFormatTool(server: McpServer): void {
	server.registerTool(
		"json_format",
		{
			description:
				"Format and validate JSON input with customizable indentation (0-8 spaces).",
			inputSchema: jsonFormatInputSchema,
		},
		handleJsonFormat,
	);
}
