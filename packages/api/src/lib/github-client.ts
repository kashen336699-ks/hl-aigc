import { z } from "zod";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;
const RATE_LIMIT_REMAINING_HEADER = "x-ratelimit-remaining";

/**
 * Classification of GitHub client failures. Consumers (e.g. `github.syncProfile`
 * procedure) map these onto the PRD business error codes:
 * - "invalid"      -> GITHUB_TOKEN_INVALID
 * - "permission"   -> GITHUB_PERMISSION_DENIED
 * - "rate_limited" -> GITHUB_RATE_LIMITED
 * - "unavailable"  -> GITHUB_UNAVAILABLE
 * - "timeout"       -> GITHUB_UNAVAILABLE (request did not complete within the
 *                       allotted time; kept distinct here for observability/logging)
 */
export type GithubClientErrorKind =
	| "invalid"
	| "permission"
	| "rate_limited"
	| "unavailable"
	| "timeout";

export class GithubClientError extends Error {
	readonly kind: GithubClientErrorKind;

	constructor(
		kind: GithubClientErrorKind,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message, options);
		this.name = "GithubClientError";
		this.kind = kind;
	}
}

const githubUserResponseSchema = z.object({
	id: z.number(),
	login: z.string(),
	node_id: z.string().nullable().optional(),
	avatar_url: z.string().nullable().optional(),
	html_url: z.string().nullable().optional(),
	name: z.string().nullable().optional(),
	company: z.string().nullable().optional(),
	blog: z.string().nullable().optional(),
	location: z.string().nullable().optional(),
	email: z.string().nullable().optional(),
	bio: z.string().nullable().optional(),
	twitter_username: z.string().nullable().optional(),
	public_repos: z.number(),
	public_gists: z.number(),
	followers: z.number(),
	following: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
});

export type GithubUserResponse = z.infer<typeof githubUserResponseSchema>;

function isRateLimitedResponse(response: Response): boolean {
	if (response.status === 429) {
		return true;
	}
	if (response.status !== 403) {
		return false;
	}
	return response.headers.get(RATE_LIMIT_REMAINING_HEADER) === "0";
}

async function requestGithubUser(token: string): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		GITHUB_REQUEST_TIMEOUT_MS
	);

	try {
		return await fetch(`${GITHUB_API_BASE_URL}/user`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			signal: controller.signal,
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new GithubClientError("timeout", "GitHub API request timed out", {
				cause: error,
			});
		}
		throw new GithubClientError("unavailable", "Failed to reach GitHub API", {
			cause: error,
		});
	} finally {
		clearTimeout(timeoutId);
	}
}

function assertOkResponse(response: Response): void {
	if (response.status === 401) {
		throw new GithubClientError(
			"invalid",
			"GitHub token is invalid or expired"
		);
	}

	if (isRateLimitedResponse(response)) {
		throw new GithubClientError(
			"rate_limited",
			"GitHub API rate limit exceeded"
		);
	}

	if (response.status === 403) {
		throw new GithubClientError(
			"permission",
			"GitHub token lacks required permission"
		);
	}

	if (!response.ok) {
		throw new GithubClientError(
			"unavailable",
			`GitHub API responded with status ${response.status}`
		);
	}
}

/**
 * Calls `GET /user` on the GitHub REST API using the provided personal access
 * token, enforces a request timeout, and classifies failures into
 * `GithubClientError` kinds. Never logs or persists the token.
 */
export async function fetchGithubUser(
	token: string
): Promise<GithubUserResponse> {
	const response = await requestGithubUser(token);
	assertOkResponse(response);

	let body: unknown;
	try {
		body = await response.json();
	} catch (error) {
		throw new GithubClientError(
			"unavailable",
			"Failed to parse GitHub API response",
			{ cause: error }
		);
	}

	const parsed = githubUserResponseSchema.safeParse(body);
	if (!parsed.success) {
		throw new GithubClientError(
			"unavailable",
			"Unexpected GitHub API response shape",
			{ cause: parsed.error }
		);
	}

	return parsed.data;
}
