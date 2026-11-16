import type { AgentProfile } from "../types/agent-profile.ts";
import { agentProfileSchema } from "../types/agent-profile.ts";
import type {
	GitHubAgentDetectionResult,
	GitHubLicense,
	GitHubRepository,
} from "../connectors/github/types.ts";
import { detectGitHubAgent } from "../connectors/github/github-agent-detector.ts";

function isValidHttpUrl(urlString?: string | null): string | undefined {
	if (!urlString || typeof urlString !== "string") return undefined;
	try {
		const parsed = new URL(urlString.trim());
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.toString()
			: undefined;
	} catch {
		return undefined;
	}
}

const KNOWN_OPEN_SOURCE_LICENSES = new Set([
	"0bsd",
	"afl-3.0",
	"agpl-3.0",
	"apache-2.0",
	"artistic-2.0",
	"bsd-2-clause",
	"bsd-3-clause",
	"bsd-3-clause-clear",
	"bsd-4-clause",
	"bsl-1.0",
	"cc0-1.0",
	"cecill-2.1",
	"cpl-1.0",
	"ecl-2.0",
	"epl-1.0",
	"epl-2.0",
	"eupl-1.1",
	"eupl-1.2",
	"gpl-2.0",
	"gpl-3.0",
	"isc",
	"lgpl-2.1",
	"lgpl-3.0",
	"mit",
	"mpl-2.0",
	"ms-pl",
	"ms-rl",
	"mulanpsl-2.0",
	"ncsa",
	"odbl-1.0",
	"ofl-1.1",
	"osl-3.0",
	"postgresql",
	"unlicense",
	"upl-1.0",
	"vim",
	"zlib",
]);

export function isOpenSourceLicense(license?: GitHubLicense | null): boolean {
	if (!license) return false;
	const spdx = (license.spdx_id || "").toLowerCase().trim();
	const key = (license.key || "").toLowerCase().trim();

	if (spdx && spdx !== "noassertion" && spdx !== "none") {
		if (KNOWN_OPEN_SOURCE_LICENSES.has(spdx)) return true;
	}
	if (key && key !== "other" && key !== "noassertion") {
		if (KNOWN_OPEN_SOURCE_LICENSES.has(key)) return true;
	}
	return false;
}

export function normalizeGitHubRepository(
	repo: GitHubRepository,
	detectionResult?: GitHubAgentDetectionResult,
	readmeContent?: string | null,
): AgentProfile {
	const detection = detectionResult ?? detectGitHubAgent(repo, readmeContent);
	// Canonical profile identifier (version is absent unless a release tag is declared)
	const profileId = `github:${repo.owner.login.toLowerCase()}/${repo.name.toLowerCase()}`;

	// GitHub is a discovery source, not an agent communication protocol.
	// Only assign communication protocols when supported by evidence (e.g. MCP, A2A).
	const protocols = new Set<string>();
	if (detection.detectedCapabilities.includes("mcp-server")) {
		protocols.add("mcp");
	}
	if (detection.detectedCapabilities.includes("a2a-agent")) {
		protocols.add("a2a");
	}

	// Categories: Only include "open-source" when justified by verified license metadata
	const categories = ["repository", detection.classification];
	if (isOpenSourceLicense(repo.license)) {
		categories.push("open-source");
	}

	const documentationUrl = isValidHttpUrl(repo.homepage) || isValidHttpUrl(repo.html_url);
	const iconUrl = isValidHttpUrl(repo.owner.avatar_url);

	const githubMetadata: Record<string, unknown> = {
		id: repo.id,
		name: repo.name,
		fullName: repo.full_name,
		owner: repo.owner.login,
		htmlUrl: repo.html_url,
		stars: repo.stargazers_count,
		forks: repo.forks_count,
		openIssues: repo.open_issues_count,
		defaultBranch: repo.default_branch,
		language: repo.language,
		topics: repo.topics || [],
		license: repo.license?.spdx_id || repo.license?.name || null,
		archived: repo.archived ?? false,
		pushedAt: repo.pushed_at,
		updatedAt: repo.updated_at,
		agentDetection: {
			classification: detection.classification,
			confidenceScore: detection.confidenceScore,
			evidence: detection.evidence,
			detectedFrameworks: detection.detectedFrameworks,
			detectedCapabilities: detection.detectedCapabilities,
		},
	};

	const profile = {
		id: profileId,
		name: repo.name,
		description: repo.description || "",
		source: {
			type: "github" as const,
			name: "GitHub",
			url: isValidHttpUrl(repo.html_url),
			identifier: repo.full_name,
		},
		classification: {
			capabilities: detection.detectedCapabilities,
			skills: detection.inferredSkills,
			categories,
			tags: repo.topics || [],
		},
		communication: {
			protocols: Array.from(protocols),
			framework: detection.detectedFrameworks[0] || undefined,
			// A repository HTML URL is a source/documentation URL, not an operational agent endpoint
			endpoint: undefined,
		},
		authentication: {
			// Never infer authentication from repository publicness; represent as undeclared
			required: false,
			declaredMethods: [],
		},
		io: {
			supportedInputs: ["text"],
			supportedOutputs: ["text"],
		},
		metadata: {
			provider: repo.owner.login,
			lastUpdated: repo.pushed_at || repo.updated_at,
			discoveryTimestamp: new Date().toISOString(),
			documentationUrl,
			iconUrl,
			github: githubMetadata,
		},
		trust: {
			status: "declared" as const,
			notes: `Discovered via GitHub repository search (unverified declared repository metadata; ${repo.stargazers_count} stars).`,
		},
	};

	return agentProfileSchema.parse(profile);
}
