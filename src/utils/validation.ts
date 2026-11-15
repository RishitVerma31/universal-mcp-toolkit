import type { ToolResult } from "../tools/types.ts";

export function createTextResult(text: string): ToolResult {
	return {
		content: [{ type: "text", text }],
	};
}

export function createErrorResult(message: string): ToolResult {
	return {
		isError: true,
		content: [{ type: "text", text: message }],
	};
}

export const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function isValidBase64(value: string): boolean {
	if (value.length === 0) {
		return true;
	}
	return BASE64_REGEX.test(value);
}
