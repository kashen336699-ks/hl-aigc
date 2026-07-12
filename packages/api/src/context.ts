import { auth } from "@hl-aigc/auth";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
	context: HonoContext;
}

const UNKNOWN_CLIENT_IP = "unknown";

/**
 * Best-effort client IP extraction for rate limiting.
 * Prefers the `x-forwarded-for` header (first entry, as set by reverse
 * proxies/load balancers), falls back to `x-real-ip`, and finally to
 * `"unknown"` so callers can apply stricter limits to that bucket.
 */
function getClientIp(context: HonoContext): string {
	const forwardedFor = context.req.header("x-forwarded-for");
	if (forwardedFor) {
		const [firstIp] = forwardedFor.split(",");
		const trimmed = firstIp?.trim();
		if (trimmed) {
			return trimmed;
		}
	}

	const realIp = context.req.header("x-real-ip");
	if (realIp) {
		return realIp.trim();
	}

	return UNKNOWN_CLIENT_IP;
}

export async function createContext({ context }: CreateContextOptions) {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		auth: null,
		session,
		clientIp: getClientIp(context),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
