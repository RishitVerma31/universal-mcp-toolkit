export interface GitHubOwner {
	login: string;
	id: number;
	avatar_url?: string;
	html_url?: string;
	type?: string;
	site_admin?: boolean;
}

export interface GitHubLicense {
	key: string;
	name: string;
	spdx_id?: string | null;
	url?: string | null;
	node_id?: string;
}

export interface GitHubRepository {
	id: number;
	node_id?: string;
	name: string;
	full_name: string;
	private: boolean;
	owner: GitHubOwner;
	html_url: string;
	description: string | null;
	fork: boolean;
	url: string;
	created_at: string;
	updated_at: string;
	pushed_at: string;
	homepage?: string | null;
	size: number;
	stargazers_count: number;
	watchers_count: number;
	language: string | null;
	forks_count: number;
	open_issues_count: number;
	default_branch: string;
	topics?: string[];
	license?: GitHubLicense | null;
	archived?: boolean;
	disabled?: boolean;
	visibility?: string;
}

export interface GitHubSearchRepositoriesResponse {
	total_count: number;
	incomplete_results: boolean;
	items: GitHubRepository[];
}

export interface GitHubReadmeResponse {
	name: string;
	path: string;
	sha: string;
	size: number;
	url: string;
	html_url: string;
	git_url?: string;
	download_url?: string | null;
	type: string;
	content: string;
	encoding: string;
	_links?: Record<string, string>;
}

export interface GitHubRateLimitInfo {
	limit?: number;
	remaining?: number;
	reset?: string;
	used?: number;
}

export type AgentClassificationType =
	| "confirmed_agent"
	| "likely_agent"
	| "framework_library"
	| "general_ai"
	| "insufficient_evidence";

export interface GitHubAgentDetectionResult {
	classification: AgentClassificationType;
	confidenceScore: number; // 0.0 to 1.0
	evidence: string[];
	detectedFrameworks: string[];
	detectedCapabilities: string[];
	inferredSkills: string[];
}

export interface GitHubSearchOptions {
	query: string;
	sort?: "stars" | "forks" | "updated" | "help-wanted-issues";
	order?: "asc" | "desc";
	perPage?: number;
	page?: number;
}

export interface GitHubClientOptions {
	baseUrl?: string;
	fetchFn?: typeof fetch;
	timeoutMs?: number;
	userAgent?: string;
}
