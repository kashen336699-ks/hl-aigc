import { Button } from "@hl-aigc/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@hl-aigc/ui/components/card";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@hl-aigc/ui/components/input-group";
import { Label } from "@hl-aigc/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { getPdrErrorMessage } from "@/lib/pdr-error";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/github-sync")({
	component: RouteComponent,
});

interface SyncResult {
	avatarUrl: string | null;
	bio: string | null;
	followers: number;
	githubId: string;
	htmlUrl: string | null;
	id: string;
	login: string;
	name: string | null;
	publicRepos: number;
	syncedAt: string | Date;
}

const tokenFormSchema = z.object({
	token: z.string().trim().min(1, "请输入 GitHub Token"),
});

const SYNCED_AT_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

function formatSyncedAt(value: string | Date): string {
	return SYNCED_AT_FORMATTER.format(new Date(value));
}

function RouteComponent() {
	const [result, setResult] = useState<SyncResult | null>(null);

	return (
		<div className="mx-auto mt-10 w-full max-w-md space-y-6 p-6">
			<div className="space-y-2 text-center">
				<h1 className="font-bold text-3xl">同步 GitHub 账户信息</h1>
				<p className="text-muted-foreground text-sm">
					输入你的 GitHub Personal Access
					Token，系统将读取并保存你的公开账户资料
				</p>
			</div>
			<GithubTokenForm onSuccess={setResult} />
			{result && <SyncResultCard result={result} />}
			<SecurityNotice />
		</div>
	);
}

function SecurityNotice() {
	return (
		<ul className="list-disc space-y-1 rounded-md bg-muted/40 p-3 pl-7 text-muted-foreground text-xs">
			<li>
				仅需授予读取个人资料的最小权限：classic PAT 使用 read:user
				权限即可，fine-grained PAT 无需勾选任何仓库权限
			</li>
			<li>Token 仅在本次请求中使用，不会被保存、记录日志或返回给页面</li>
			<li>
				同步将保存你的公开资料：用户名、头像、主页、姓名、公司、简介、公开邮箱、所在地及仓库/粉丝等统计数据
			</li>
		</ul>
	);
}

function GithubTokenForm({
	onSuccess,
}: {
	onSuccess: (result: SyncResult) => void;
}) {
	const [showToken, setShowToken] = useState(false);

	const syncProfileMutation = useMutation(
		trpc.github.syncProfile.mutationOptions()
	);

	const form = useForm({
		defaultValues: {
			token: "",
		},
		onSubmit: async ({ value, formApi }) => {
			if (syncProfileMutation.isPending) {
				return;
			}

			try {
				const synced = await syncProfileMutation.mutateAsync({
					token: value.token,
				});
				onSuccess(synced);
				toast.success("GitHub 账户信息同步成功");
			} catch (error) {
				toast.error(getPdrErrorMessage(error, "同步失败，请稍后重试"));
			} finally {
				// Clear the token on every submit attempt, not just success —
				// it should never linger in the DOM after being sent (F-002).
				formApi.reset();
				setShowToken(false);
			}
		},
		validators: {
			onSubmit: tokenFormSchema,
		},
	});

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="token">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={field.name}>GitHub Personal Access Token</Label>
						<InputGroup>
							<InputGroupInput
								autoComplete="off"
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
								type={showToken ? "text" : "password"}
								value={field.state.value}
							/>
							<InputGroupAddon align="inline-end">
								<InputGroupButton
									aria-label={showToken ? "隐藏 Token" : "显示 Token"}
									aria-pressed={showToken}
									onClick={() => setShowToken((prev) => !prev)}
									size="icon-xs"
									type="button"
								>
									{showToken ? <EyeOff /> : <Eye />}
								</InputGroupButton>
							</InputGroupAddon>
						</InputGroup>
						{field.state.meta.errors.map((error) => (
							<p className="text-destructive text-xs" key={error?.message}>
								{error?.message}
							</p>
						))}
					</div>
				)}
			</form.Field>

			<form.Subscribe
				selector={(state) => ({
					canSubmit: state.canSubmit,
					isSubmitting: state.isSubmitting,
				})}
			>
				{({ canSubmit, isSubmitting }) => (
					<Button
						className="w-full"
						disabled={
							!canSubmit || isSubmitting || syncProfileMutation.isPending
						}
						type="submit"
					>
						{syncProfileMutation.isPending ? "同步中..." : "获取账户信息"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}

function SyncResultCard({ result }: { result: SyncResult }) {
	return (
		<Card>
			<CardHeader className="flex-row items-center gap-3">
				{result.avatarUrl && (
					<img
						alt={`${result.login} avatar`}
						className="size-12 rounded-full"
						height={48}
						src={result.avatarUrl}
						width={48}
					/>
				)}
				<div>
					<CardTitle>{result.name ?? result.login}</CardTitle>
					<p className="text-muted-foreground text-xs">@{result.login}</p>
				</div>
			</CardHeader>
			<CardContent className="space-y-2 text-xs">
				{result.bio && <p>{result.bio}</p>}
				{result.htmlUrl && (
					<p>
						<a
							className="text-primary underline-offset-4 hover:underline"
							href={result.htmlUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							{result.htmlUrl}
						</a>
					</p>
				)}
				<p className="flex gap-4 text-muted-foreground">
					<span>公开仓库 {result.publicRepos}</span>
					<span>粉丝 {result.followers}</span>
				</p>
				<p className="text-muted-foreground">
					最近同步于 {formatSyncedAt(result.syncedAt)}
				</p>
			</CardContent>
		</Card>
	);
}
