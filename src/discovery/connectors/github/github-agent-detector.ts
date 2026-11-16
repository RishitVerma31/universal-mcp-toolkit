import type {
	AgentClassificationType,
	GitHubAgentDetectionResult,
	GitHubRepository,
} from "./types.ts";

interface FrameworkDescriptor {
	name: string;
	pattern: RegExp;
}

const KNOWN_FRAMEWORKS: FrameworkDescriptor[] = [
	{ name: "LangGraph", pattern: /\blanggraph\b/i },
	{ name: "CrewAI", pattern: /\bcrew-?ai\b/i },
	{ name: "AutoGen", pattern: /\b(auto-?gen|pyautogen)\b/i },
	{ name: "OpenAI Agents SDK / Swarm", pattern: /\b(openai-agents|openai-swarm|swarm-agent)\b/i },
	{ name: "Google ADK", pattern: /\b(google-adk|genai-agents)\b/i },
	{ name: "Semantic Kernel", pattern: /\bsemantic-kernel\b/i },
	{ name: "LlamaIndex Agents", pattern: /\b(llama-?index|llama-agents)\b/i },
	{ name: "Haystack Agents", pattern: /\bhaystack(?:-ai)?\b/i },
	{ name: "MCP Agent / Server", pattern: /\b(modelcontextprotocol|mcp-server|mcp-agent)\b/i },
	{ name: "A2A Agent", pattern: /\b(a2a-protocol|a2a-agent|agent-to-agent)\b/i },
	{ name: "Smolagents", pattern: /\bsmolagents\b/i },
	{ name: "Phidata", pattern: /\bphidata\b/i },
	{ name: "MetaGPT", pattern: /\bmetagpt\b/i },
	{ name: "AutoGPT", pattern: /\bauto-?gpt\b/i },
	{ name: "ChatDev", pattern: /\bchatdev\b/i },
	{ name: "BabyAGI", pattern: /\bbabyagi\b/i },
];

const GENERAL_AI_PATTERNS = [
	/\b(pytorch|tensorflow|keras|scikit-learn)\b/i,
	/\b(fine-?tuning|lora|qlora|quantization|diffusion-model)\b/i,
	/\b(dataset|benchmark|corpus|tokenizer)\b/i,
	/\b(transformer-models|computer-vision|cnn|rnn|gan)\b/i,
	/\b(prompt-engineering|prompt-templates|prompts-list)\b/i,
];

interface CapabilityDescriptor {
	capability: string;
	metadataPattern: RegExp;
	readmePattern?: RegExp;
}

const CAPABILITY_PATTERNS: CapabilityDescriptor[] = [
	{
		capability: "tool-use",
		metadataPattern:
			/\b(tool(?:-|\s)?use|function(?:-|\s)?call(?:ing)?|tool(?:-|\s)?calling|tools)\b/i,
		readmePattern: /\b(tool(?:-|\s)?use|function(?:-|\s)?call(?:ing)?|tool(?:-|\s)?calling)\b/i,
	},
	{
		capability: "multi-agent",
		metadataPattern:
			/\b(multi(?:-|\s)?agent|agent(?:-|\s)?collaboration|swarm|team(?:-|\s)?of(?:-|\s)?agents|hierarchical(?:-|\s)?agent)\b/i,
		readmePattern:
			/\b(multi(?:-|\s)?agent|agent(?:-|\s)?collaboration|agent(?:-|\s)?swarm|team(?:-|\s)?of(?:-|\s)?agents)\b/i,
	},
	{
		capability: "autonomous-loop",
		metadataPattern:
			/\b(autonomous(?:-|\s)?agent|react(?:-|\s)?agent|agentic(?:-|\s)?loop|plan(?:-|\s)?and(?:-|\s)?execute|self(?:-|\s)?reflection)\b/i,
		readmePattern:
			/\b(autonomous(?:-|\s)?agent|react(?:-|\s)?agent|agentic(?:-|\s)?loop|plan(?:-|\s)?and(?:-|\s)?execute)\b/i,
	},
	{
		capability: "memory",
		metadataPattern:
			/\b(vector(?:-|\s)?store|agent(?:-|\s)?memory|short(?:-|\s)?term(?:-|\s)?memory|long(?:-|\s)?term(?:-|\s)?memory|rag)\b/i,
		readmePattern:
			/\b(agent(?:-|\s)?memory|short(?:-|\s)?term(?:-|\s)?memory|long(?:-|\s)?term(?:-|\s)?memory)\b/i,
	},
	{
		capability: "mcp-server",
		metadataPattern: /\b(mcp-server|modelcontextprotocol|mcp-tool)\b/i,
		readmePattern: /\b(mcp-server|modelcontextprotocol|mcp-tool)\b/i,
	},
	{
		capability: "a2a-agent",
		metadataPattern: /\b(a2a-protocol|agent-to-agent|agentcard)\b/i,
		readmePattern: /\b(a2a-protocol|agent-to-agent|agentcard\.json)\b/i,
	},
	{
		capability: "code-execution",
		// Strictly require explicit sandbox or interpreter markers in README; metadata can declare code-execution or sandbox
		metadataPattern:
			/\b(code-execution|code-interpreter|eval-sandbox|code-execution-sandbox)\b/i,
		readmePattern:
			/\b(code_interpreter|python_repl|sandbox\.exec|docker_sandbox|e2b_sandbox|repl_tool|code_execution_mode)\b/i,
	},
	{
		capability: "streaming",
		metadataPattern: /\b(streaming(?:-|\s)?responses?|stream(?:-|\s)?events)\b/i,
		readmePattern: /\b(streaming(?:-|\s)?responses?|stream(?:-|\s)?events)\b/i,
	},
];

const FRAMEWORK_LIBRARY_PATTERNS = [
	/\bframework for (?:building|developing|orchestrating|running) (?:ai |autonomous )?agents\b/i,
	/\bsdk for (?:building|developing|orchestrating|running) (?:ai |autonomous )?agents\b/i,
	/\blibrary for (?:building|developing|orchestrating|running) (?:ai |autonomous )?agents\b/i,
	/\btoolkit for (?:building|developing|orchestrating|running) (?:ai |autonomous )?agents\b/i,
	/\bagent framework\b/i,
	/\bmulti-agent framework\b/i,
	/\bframework for (?:agentic|multi-agent)\b/i,
];

export function detectGitHubAgent(
	repo: GitHubRepository,
	readmeContent?: string | null,
): GitHubAgentDetectionResult {
	const evidence: string[] = [];
	const detectedFrameworksSet = new Set<string>();
	const detectedCapabilitiesSet = new Set<string>();
	const inferredSkillsSet = new Set<string>();

	let agentScore = 0;
	let generalAiScore = 0;
	let isFrameworkLibrary = false;

	const repoName = repo.name.toLowerCase();
	const repoFullName = repo.full_name.toLowerCase();
	const repoDesc = (repo.description || "").toLowerCase();
	const topics = (repo.topics || []).map((t) => t.toLowerCase());
	const readme = (readmeContent || "").toLowerCase();

	const combinedMetadata = `${repoFullName} ${repoDesc} ${topics.join(" ")}`;

	// 1. Framework inspection
	for (const fw of KNOWN_FRAMEWORKS) {
		if (fw.pattern.test(combinedMetadata) || (readme && fw.pattern.test(readme))) {
			detectedFrameworksSet.add(fw.name);
			evidence.push(`framework:${fw.name}`);
			agentScore += 4;
		}
	}

	// 2. Topics evidence
	for (const topic of topics) {
		if (
			topic === "agent" ||
			topic === "agents" ||
			topic === "ai-agent" ||
			topic === "ai-agents" ||
			topic === "autonomous-agents" ||
			topic === "autonomous-agent" ||
			topic === "multi-agent" ||
			topic === "multi-agent-systems" ||
			topic === "agentic" ||
			topic === "agentic-ai"
		) {
			evidence.push(`topic:${topic}`);
			agentScore += 3;
		} else if (
			topic === "agent-framework" ||
			topic === "agent-sdk" ||
			topic === "multi-agent-framework"
		) {
			evidence.push(`topic:${topic}`);
			isFrameworkLibrary = true;
			agentScore += 4;
		} else if (
			topic === "llm" ||
			topic === "ai" ||
			topic === "machine-learning" ||
			topic === "deep-learning"
		) {
			generalAiScore += 1;
		}
	}

	// 3. Name evidence
	if (
		/\b(agent|agents|agentic)\b/i.test(repoName) ||
		/-(?:agent|agents)$/i.test(repoName) ||
		/^(?:agent|agents)-/i.test(repoName)
	) {
		evidence.push(`repo-name:${repo.name}`);
		agentScore += 3;
	}

	// 4. Description evidence
	if (/\b(?:autonomous|agentic|multi-agent)\b/i.test(repoDesc)) {
		evidence.push("description:autonomous/agentic");
		agentScore += 3;
	} else if (/\b(?:ai agent|ai agents|software agent|intelligent agent)\b/i.test(repoDesc)) {
		evidence.push("description:ai-agent");
		agentScore += 3;
	}

	// 5. Framework/Library detection in description or topics
	for (const flPattern of FRAMEWORK_LIBRARY_PATTERNS) {
		if (flPattern.test(repoDesc) || flPattern.test(topics.join(" "))) {
			isFrameworkLibrary = true;
			evidence.push("descriptor:agent-framework-library");
			agentScore += 4;
			break;
		}
	}

	// 6. Capability analysis: strictly distinguish metadata-declared from README-inferred
	for (const cap of CAPABILITY_PATTERNS) {
		const inMetadata = cap.metadataPattern.test(combinedMetadata);
		const inReadme = readme && cap.readmePattern ? cap.readmePattern.test(readme) : false;

		if (inMetadata) {
			detectedCapabilitiesSet.add(cap.capability);
			evidence.push(`metadata:capability:${cap.capability}`);
			agentScore += 2;
		} else if (inReadme) {
			detectedCapabilitiesSet.add(cap.capability);
			// Explicitly mark README-derived capabilities as inferred evidence
			evidence.push(`inferred:readme:capability:${cap.capability}`);
			agentScore += 1;
		}
	}

	// 7. General AI markers (to distinguish general ML/AI projects from agents)
	for (const gPattern of GENERAL_AI_PATTERNS) {
		if (gPattern.test(combinedMetadata) || (readme && gPattern.test(readme))) {
			generalAiScore += 2;
		}
	}

	// 8. README inspection (if present)
	if (readme) {
		if (/\b(agent\.run|agent\.chat|agent\.step|run_agent|agent\.invoke)\b/i.test(readme)) {
			evidence.push("readme:agent-execution-api");
			agentScore += 3;
		}
		if (/(?:tools\s*=|tool_calls|register_tool|custom_tools)/i.test(readme)) {
			evidence.push("readme:tool-definition");
			if (!detectedCapabilitiesSet.has("tool-use")) {
				detectedCapabilitiesSet.add("tool-use");
				evidence.push("inferred:readme:capability:tool-use");
			}
			agentScore += 2;
		}
		if (/\b(system_prompt|system_message|role:\s*["']system["'])\b/i.test(readme)) {
			evidence.push("readme:agent-system-prompt");
			agentScore += 1;
		}
	}

	// Infer skills from topics and capabilities
	if (detectedCapabilitiesSet.has("tool-use")) {
		inferredSkillsSet.add("tool-calling");
	}
	if (detectedCapabilitiesSet.has("multi-agent")) {
		inferredSkillsSet.add("agent-delegation");
	}
	if (detectedCapabilitiesSet.has("code-execution")) {
		inferredSkillsSet.add("code-interpreter");
	}
	if (detectedCapabilitiesSet.has("memory")) {
		inferredSkillsSet.add("context-retrieval");
	}

	// Substantive evidence check: confirmed_agent requires real operational evidence
	// (known framework, multiple capabilities, or execution API), not merely weak keyword hits
	const hasSubstantiveEvidence =
		detectedFrameworksSet.size > 0 ||
		detectedCapabilitiesSet.size >= 2 ||
		(evidence.some(
			(e) => e === "readme:agent-execution-api" || e === "readme:tool-definition",
		) &&
			detectedCapabilitiesSet.size >= 1);

	// Decision & Classification with deterministic precedence:
	// 1. framework_library: SDKs/toolkits for constructing agents are never operational agents
	// 2. confirmed_agent: requires high score AND substantive evidence
	// 3. likely_agent: moderate evidence or keyword hits lacking operational proof
	// 4. general_ai: ML/dataset without agentic loops
	// 5. insufficient_evidence: weak or unrelated
	let classification: AgentClassificationType;
	let confidenceScore: number;

	if (isFrameworkLibrary) {
		classification = "framework_library";
		confidenceScore = Math.min(0.95, 0.7 + Math.min(agentScore, 10) * 0.025);
	} else if (agentScore >= 6 && hasSubstantiveEvidence) {
		classification = "confirmed_agent";
		confidenceScore = Math.min(0.95, 0.65 + Math.min(agentScore, 15) * 0.02);
	} else if (
		agentScore >= 3 ||
		(agentScore >= 1 && (detectedCapabilitiesSet.size > 0 || detectedFrameworksSet.size > 0))
	) {
		classification = "likely_agent";
		confidenceScore = Math.min(0.64, 0.35 + Math.min(agentScore, 10) * 0.025);
	} else if (generalAiScore >= 2 && agentScore < 2) {
		classification = "general_ai";
		confidenceScore = Math.min(0.3, Math.max(0.1, generalAiScore * 0.05));
	} else {
		classification = "insufficient_evidence";
		confidenceScore = Math.min(0.2, Math.max(0.05, agentScore * 0.05));
	}

	// Bounded between 0.0 and 1.0, rounded to 2 decimal places
	confidenceScore = Math.max(0.0, Math.min(1.0, Math.round(confidenceScore * 100) / 100));

	return {
		classification,
		confidenceScore,
		evidence,
		detectedFrameworks: Array.from(detectedFrameworksSet),
		detectedCapabilities: Array.from(detectedCapabilitiesSet),
		inferredSkills: Array.from(inferredSkillsSet),
	};
}
