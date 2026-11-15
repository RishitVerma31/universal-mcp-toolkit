import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";
import { validateAndNormalizeProfile } from "../../discovery/normalizer/profile-validator.ts";

export const validateAgentProfileInputSchema = z.object({
	profile: z
		.union([
			z.record(z.string(), z.unknown()),
			z
				.string()
				.max(512_000, "Profile JSON string must not exceed 512KB")
				.describe("JSON string representation of candidate profile"),
		])
		.describe(
			"Candidate agent profile JSON object or string to validate against Universal Agent Profile specifications",
		),
	normalize: z
		.boolean()
		.default(true)
		.describe("Whether to auto-fill safe defaults and normalize structure (default: true)"),
});

export type ValidateAgentProfileInput = z.input<typeof validateAgentProfileInputSchema>;

function checkNestingDepth(obj: unknown, currentDepth = 0, maxDepth = 6): boolean {
	if (currentDepth > maxDepth) return false;
	if (typeof obj !== "object" || obj === null) return true;
	for (const key of Object.keys(obj)) {
		const val = (obj as Record<string, unknown>)[key];
		if (typeof val === "object" && val !== null) {
			if (!checkNestingDepth(val, currentDepth + 1, maxDepth)) {
				return false;
			}
		}
	}
	return true;
}

export async function handleValidateAgentProfile(input: ValidateAgentProfileInput) {
	try {
		const parsedInput = validateAgentProfileInputSchema.parse(input);
		let rawObj: Record<string, unknown>;

		if (typeof parsedInput.profile === "string") {
			try {
				rawObj = JSON.parse(parsedInput.profile);
			} catch (parseErr) {
				return createErrorResult(
					`Invalid JSON provided for profile: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
				);
			}
		} else {
			rawObj = parsedInput.profile;
		}

		if (typeof rawObj !== "object" || rawObj === null || Array.isArray(rawObj)) {
			return createErrorResult("Agent profile must be a valid JSON object.");
		}

		if (Object.keys(rawObj).length > 100) {
			return createErrorResult(
				"Agent profile object contains excessive top-level keys (maximum: 100).",
			);
		}

		if (!checkNestingDepth(rawObj, 0, 6)) {
			return createErrorResult(
				"Agent profile object exceeds maximum allowed nesting depth (6 levels).",
			);
		}

		const result = validateAndNormalizeProfile(rawObj, parsedInput.normalize ?? true);

		return createTextResult(JSON.stringify(result, null, 2));
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return createErrorResult(`Profile validation failed: ${message}`);
	}
}

export function registerValidateAgentProfileTool(server: McpServer): void {
	server.registerTool(
		"validate_agent_profile",
		{
			description:
				"Validate and normalize a candidate agent profile against the Universal Agent Profile schema. Stateless operation; does not persist data or contact endpoints.",
			inputSchema: validateAgentProfileInputSchema,
		},
		handleValidateAgentProfile,
	);
}
