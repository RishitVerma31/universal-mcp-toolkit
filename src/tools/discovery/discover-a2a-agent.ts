import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { createTextResult, createErrorResult } from "../../utils/validation.ts";
import { A2AAgentCardClient } from "../../discovery/connectors/a2a/client.ts";
import { normalizeA2aAgentCard } from "../../discovery/normalizer/a2a-agent-card-normalizer.ts";

export const discoverA2aAgentInputSchema = z.object({
	agent_url: z
		.string()
		.trim()
		.min(1, "Agent URL cannot be empty")
		.max(2048, "Agent URL must not exceed 2048 characters")
		.describe(
			"Public HTTPS base URL of the A2A agent (e.g. https://agent.example.com) or direct Agent Card URL (e.g. https://agent.example.com/.well-known/agent-card.json)",
		),
});

export type DiscoverA2aAgentInput = z.input<typeof discoverA2aAgentInputSchema>;

export async function handleDiscoverA2aAgent(
	input: DiscoverA2aAgentInput,
	client: A2AAgentCardClient = new A2AAgentCardClient(),
) {
	try {
		const parsedInput = discoverA2aAgentInputSchema.parse(input);
		const discovery = await client.fetchAgentCard(parsedInput.agent_url);
		const normalizedProfile = normalizeA2aAgentCard(discovery.card, discovery.agentCardUrl);

		const responsePayload = {
			status: "discovered",
			agentUrl: parsedInput.agent_url,
			agentCardUrl: discovery.agentCardUrl,
			agent: {
				name: discovery.card.name,
				description: discovery.card.description || "",
				version: discovery.card.version || (discovery.card as any).agentVersion || "0.1.0",
				protocolVersion:
					discovery.card.supportedInterfaces?.[0]?.protocolVersion ||
					(discovery.card as any).protocolVersion ||
					(discovery.card as any).schemaVersion ||
					"1.0",
				provider: discovery.card.provider || null,
				documentationUrl: discovery.card.documentationUrl || null,
				iconUrl: discovery.card.iconUrl || null,
			},
			interfaces: discovery.card.supportedInterfaces || [],
			skills: (discovery.card.skills || []).map((s) => ({
				id: s.id,
				name: s.name,
				description: s.description || "",
				tags: s.tags || [],
				examplesCount: s.examples?.length ?? 0,
			})),
			capabilities: discovery.card.capabilities || {},
			signatures: discovery.card.signatures || [],
			inputModes: discovery.card.defaultInputModes || ["text/plain", "application/json"],
			outputModes: discovery.card.defaultOutputModes || ["application/json"],
			authentication: {
				required: normalizedProfile.authentication.required,
				declaredMethods: normalizedProfile.authentication.declaredMethods,
			},
			trust: normalizedProfile.trust,
			profile: normalizedProfile,
		};

		return createTextResult(JSON.stringify(responsePayload, null, 2));
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return createErrorResult(`A2A Agent discovery failed: ${message}`);
	}
}

export function registerDiscoverA2aAgentTool(
	server: McpServer,
	client: A2AAgentCardClient = new A2AAgentCardClient(),
): void {
	server.registerTool(
		"discover_a2a_agent",
		{
			description:
				"Discover an A2A (Agent-to-Agent) agent by retrieving and validating its public Agent Card from its well-known endpoint, returning a normalized Universal Agent Profile and service metadata.",
			inputSchema: discoverA2aAgentInputSchema,
		},
		(args) => handleDiscoverA2aAgent(args, client),
	);
}
