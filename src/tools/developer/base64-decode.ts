import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult, isValidBase64 } from "../../utils/validation.ts";

export const base64DecodeInputSchema = z.object({
	encoded: z.string().describe("The Base64 string to decode into UTF-8 text"),
});

export type Base64DecodeInput = z.infer<typeof base64DecodeInputSchema>;

export function base64Decode(encoded: string): string {
	if (encoded.length === 0) {
		return "";
	}

	if (!isValidBase64(encoded)) {
		throw new Error(
			"Invalid Base64 string: input contains invalid characters, incorrect padding, or improper length.",
		);
	}

	try {
		const binary = atob(encoded);
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
	} catch (err) {
		const error = new Error(
			`Failed to decode Base64 data: ${err instanceof Error ? err.message : String(err)}`,
		);
		(error as any).cause = err;
		throw error;
	}
}

export async function handleBase64Decode({ encoded }: Base64DecodeInput) {
	try {
		const decoded = base64Decode(encoded);
		return createTextResult(decoded);
	} catch (err) {
		return createErrorResult(err instanceof Error ? err.message : String(err));
	}
}

export function registerBase64DecodeTool(server: McpServer): void {
	server.registerTool(
		"base64_decode",
		{
			description:
				"Decode a Base64 string into UTF-8 text with strict validation and full Unicode support.",
			inputSchema: base64DecodeInputSchema,
		},
		handleBase64Decode,
	);
}
