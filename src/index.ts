import { createMcpHandler } from "agents/mcp/server";
import { createServer } from "./server.ts";

const handler = createMcpHandler(createServer);

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
