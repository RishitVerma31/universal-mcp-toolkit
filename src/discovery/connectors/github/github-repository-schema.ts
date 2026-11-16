import { z } from "zod";

export const gitHubOwnerSchema = z.object({
	login: z.string().min(1),
	id: z.number().int(),
	avatar_url: z.string().optional(),
	html_url: z.string().optional(),
	type: z.string().optional(),
	site_admin: z.boolean().optional(),
});

export const gitHubLicenseSchema = z.object({
	key: z.string(),
	name: z.string(),
	spdx_id: z.string().nullable().optional(),
	url: z.string().nullable().optional(),
	node_id: z.string().optional(),
});

export const gitHubRepositorySchema = z.object({
	id: z.number().int(),
	node_id: z.string().optional(),
	name: z.string().min(1),
	full_name: z.string().min(1),
	private: z.boolean().default(false),
	owner: gitHubOwnerSchema,
	html_url: z.string().url(),
	description: z.string().nullable().default(null),
	fork: z.boolean().default(false),
	url: z.string(),
	created_at: z.string().default(() => new Date().toISOString()),
	updated_at: z.string().default(() => new Date().toISOString()),
	pushed_at: z.string().default(() => new Date().toISOString()),
	homepage: z.string().nullable().optional(),
	size: z.number().int().default(0),
	stargazers_count: z.number().int().default(0),
	watchers_count: z.number().int().default(0),
	language: z.string().nullable().default(null),
	forks_count: z.number().int().default(0),
	open_issues_count: z.number().int().default(0),
	default_branch: z.string().default("main"),
	topics: z.array(z.string()).default([]),
	license: gitHubLicenseSchema.nullable().optional(),
	archived: z.boolean().optional(),
	disabled: z.boolean().optional(),
	visibility: z.string().optional(),
});

export const gitHubSearchRepositoriesResponseSchema = z.object({
	total_count: z.number().int(),
	incomplete_results: z.boolean().default(false),
	items: z.array(gitHubRepositorySchema),
});

export const gitHubReadmeResponseSchema = z.object({
	name: z.string(),
	path: z.string(),
	sha: z.string(),
	size: z.number().int(),
	url: z.string(),
	html_url: z.string(),
	git_url: z.string().optional(),
	download_url: z.string().nullable().optional(),
	type: z.string(),
	content: z.string(),
	encoding: z.string(),
	_links: z.record(z.string(), z.string()).optional(),
});
