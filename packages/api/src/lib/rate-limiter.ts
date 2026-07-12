/**
 * In-process sliding window rate limiter.
 *
 * Tracks request timestamps per key (e.g. client IP) in memory and allows a
 * request only if fewer than `maxRequests` timestamps fall within the
 * trailing `windowMs` window. This is a single-instance limiter: in a
 * multi-instance deployment each process keeps its own counters, so the
 * effective global limit is multiplied by the instance count. That is an
 * accepted V1.0 limitation (see specs/1.github-account-sync/tasks.md,
 * "限流的分布式局限"); a centralized store (e.g. Redis) is required for
 * multi-instance correctness and is out of scope here.
 */

export interface RateLimiterOptions {
	/** Maximum number of allowed requests within the window. */
	maxRequests: number;
	/** Length of the sliding window, in milliseconds. */
	windowMs: number;
}

export interface RateLimitResult {
	/** Whether the request is allowed under the current limit. */
	allowed: boolean;
	/** Number of remaining requests allowed in the current window. */
	remaining: number;
	/** Milliseconds until the caller may retry; 0 when `allowed` is true. */
	retryAfterMs: number;
}

/** How often (ms) stale keys are purged from memory during `check()` calls. */
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Sliding window rate limiter keyed by an arbitrary string (e.g. client IP).
 *
 * Not thread-safe across processes/workers — intended for a single Node/Bun
 * process. Create one instance per limiting policy and reuse it across
 * requests (do not construct a new instance per call).
 */
export class SlidingWindowRateLimiter {
	private readonly windowMs: number;
	private readonly maxRequests: number;
	private readonly hitsByKey = new Map<string, number[]>();
	private lastCleanupAt = Date.now();

	constructor(options: RateLimiterOptions) {
		this.windowMs = options.windowMs;
		this.maxRequests = options.maxRequests;
	}

	/**
	 * Records an attempt for `key` at `now` and reports whether it is allowed.
	 * When over the limit, the attempt is NOT recorded (rejected requests
	 * don't consume quota further).
	 */
	check(key: string, now: number = Date.now()): RateLimitResult {
		const windowStart = now - this.windowMs;
		const existingTimestamps = this.hitsByKey.get(key) ?? [];
		const recentTimestamps = existingTimestamps.filter(
			(timestamp) => timestamp > windowStart
		);

		if (recentTimestamps.length >= this.maxRequests) {
			this.hitsByKey.set(key, recentTimestamps);
			this.maybeCleanup(now);
			return {
				allowed: false,
				remaining: 0,
				retryAfterMs: this.retryAfterMs(recentTimestamps, now),
			};
		}

		recentTimestamps.push(now);
		this.hitsByKey.set(key, recentTimestamps);
		this.maybeCleanup(now);

		return {
			allowed: true,
			remaining: Math.max(this.maxRequests - recentTimestamps.length, 0),
			retryAfterMs: 0,
		};
	}

	/** Clears recorded attempts for a single key (mainly useful in tests). */
	reset(key: string): void {
		this.hitsByKey.delete(key);
	}

	/** Clears all recorded attempts (mainly useful in tests). */
	clear(): void {
		this.hitsByKey.clear();
	}

	private retryAfterMs(recentTimestamps: number[], now: number): number {
		const oldestTimestamp = recentTimestamps[0];
		if (oldestTimestamp === undefined) {
			return this.windowMs;
		}
		return Math.max(oldestTimestamp + this.windowMs - now, 0);
	}

	/** Periodically evicts keys with no timestamps left in the window. */
	private maybeCleanup(now: number): void {
		if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) {
			return;
		}
		this.lastCleanupAt = now;
		const windowStart = now - this.windowMs;
		for (const [key, timestamps] of this.hitsByKey) {
			const recentTimestamps = timestamps.filter(
				(timestamp) => timestamp > windowStart
			);
			if (recentTimestamps.length === 0) {
				this.hitsByKey.delete(key);
			} else {
				this.hitsByKey.set(key, recentTimestamps);
			}
		}
	}
}

/** Creates a new sliding window rate limiter instance. */
export function createRateLimiter(
	options: RateLimiterOptions
): SlidingWindowRateLimiter {
	return new SlidingWindowRateLimiter(options);
}
