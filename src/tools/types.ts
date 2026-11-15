export interface ToolResult {
	[x: string]: unknown;
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError?: boolean;
}
