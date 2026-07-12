import { TRPCClientError } from "@trpc/client";

/**
 * Maps PRD business error codes (specs/1.github-account-sync/design.md,
 * "错误码传递") to user-facing Chinese copy. The server attaches `pdrCode` to
 * the tRPC error shape via the `errorFormatter` in packages/api/src/index.ts.
 */
const PDR_ERROR_MESSAGES: Record<string, string> = {
	VALIDATION_ERROR: "输入内容不合法，请检查后重试",
	GITHUB_TOKEN_INVALID: "GitHub Token 无效或已过期",
	GITHUB_PERMISSION_DENIED: "GitHub Token 权限不足",
	GITHUB_RATE_LIMITED: "请求过于频繁，请稍后再试",
	GITHUB_UNAVAILABLE: "GitHub 服务暂时不可用，请稍后重试",
	DATABASE_ERROR: "服务器内部错误，请稍后重试",
	FIELD_KEY_CONFLICT: "该标识已存在，请更换后重试",
	SYSTEM_FIELD_PROTECTED: "系统字段不可删除",
	FIELD_NOT_FOUND: "字段不存在或已被删除",
};

export function getPdrErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof TRPCClientError) {
		const pdrCode = (error.data as { pdrCode?: string } | undefined)?.pdrCode;
		if (pdrCode && pdrCode in PDR_ERROR_MESSAGES) {
			return PDR_ERROR_MESSAGES[pdrCode] as string;
		}
		if (error.message) {
			return error.message;
		}
	}
	return fallback;
}
