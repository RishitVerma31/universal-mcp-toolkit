import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";

export const hashAlgorithmSchema = z.enum(["SHA-256", "SHA-384", "SHA-512"]);
export type HashAlgorithm = z.infer<typeof hashAlgorithmSchema>;

export const hashTextInputSchema = z.object({
	text: z.string().describe("The text to hash"),
	algorithm: hashAlgorithmSchema
		.default("SHA-256")
		.describe(
			"The cryptographic hash algorithm: SHA-256, SHA-384, or SHA-512 (default: SHA-256)",
		),
});

export type HashTextInput = z.infer<typeof hashTextInputSchema>;

export async function hashText(
	text: string,
	algorithm: HashAlgorithm = "SHA-256",
): Promise<string> {
	const data = new TextEncoder().encode(text);
	const digestBuffer = await crypto.subtle.digest(algorithm, data);
	const hashArray = Array.from(new Uint8Array(digestBuffer));
	return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleHashText({ text, algorithm }: HashTextInput) {
	try {
		const hash = await hashText(text, algorithm);
		return createTextResult(hash);
	} catch (err) {
		return createErrorResult(
			`Failed to generate hash: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

export function registerHashTextTool(server: McpServer): void {
	server.registerTool(
		"hash_text",
		{
			description:
				"Generate a cryptographic hash (SHA-256, SHA-384, or SHA-512) of text in lowercase hexadecimal.",
			inputSchema: hashTextInputSchema,
		},
		handleHashText,
	);
}
