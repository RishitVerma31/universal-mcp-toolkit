import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult } from "../../utils/validation.ts";

export const base64EncodeInputSchema = z.object({
	text: z.string().describe("The text to encode into Base64"),
});

export type Base64EncodeInput = z.infer<typeof base64EncodeInputSchema>;

export function base64Encode(text: string): string {
	if (typeof Buffer !== "undefined") {
		return Buffer.from(text, "utf-8").toString("base64");
	}
	const bytes = new TextEncoder().encode(text);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export async function handleBase64Encode({ text }: Base64EncodeInput) {
	const encoded = base64Encode(text);
	return createTextResult(encoded);
}

export function registerBase64EncodeTool(server: McpServer): void {
	server.registerTool(
		"base64_encode",
		{
			description:
				"Encode UTF-8 text into Base64 format with full Unicode and emoji support.",
			inputSchema: base64EncodeInputSchema,
		},
		handleBase64Encode,
	);
}
