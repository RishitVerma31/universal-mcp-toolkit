export interface McpRegistryRemote {
	type: string;
	url: string;
}

export interface McpRegistryRepository {
	url?: string;
	source?: string;
	id?: string;
	subfolder?: string;
}

export interface McpRegistryPackage {
	registry: string;
	name: string;
	version?: string;
}

export interface McpRegistryServer {
	$schema?: string;
	name: string;
	title?: string;
	description?: string;
	version: string;
	remotes?: McpRegistryRemote[];
	repository?: McpRegistryRepository;
	packages?: McpRegistryPackage[];
}

export interface McpRegistryOfficialMeta {
	status?: string;
	statusChangedAt?: string;
	publishedAt?: string;
	updatedAt?: string;
	isLatest?: boolean;
}

export interface McpRegistryMeta {
	"io.modelcontextprotocol.registry/official"?: McpRegistryOfficialMeta;
	[key: string]: unknown;
}

export interface McpRegistryServerEntry {
	server: McpRegistryServer;
	_meta?: McpRegistryMeta;
}

export interface McpRegistryListResponse {
	servers: McpRegistryServerEntry[];
	metadata?: {
		nextCursor?: string;
		count?: number;
	};
}

export interface McpRegistryDetailResponse {
	server: McpRegistryServer;
	_meta?: McpRegistryMeta;
}
