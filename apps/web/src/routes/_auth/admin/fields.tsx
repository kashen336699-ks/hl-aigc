import { Button } from "@hl-aigc/ui/components/button";
import { Checkbox } from "@hl-aigc/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@hl-aigc/ui/components/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@hl-aigc/ui/components/empty";
import { Input } from "@hl-aigc/ui/components/input";
import { Label } from "@hl-aigc/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@hl-aigc/ui/components/select";
import { Skeleton } from "@hl-aigc/ui/components/skeleton";
import { Textarea } from "@hl-aigc/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseZap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { getPdrErrorMessage } from "@/lib/pdr-error";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/admin/fields")({
	component: AdminFieldsPage,
});

type FieldType = "text" | "textarea" | "number" | "boolean" | "datetime";

interface FieldDefinition {
	createdAt: string | Date;
	description: string | null;
	id: string;
	isSystem: boolean;
	key: string;
	name: string;
	required: boolean;
	type: FieldType;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
	text: "单行文本",
	textarea: "多行文本",
	number: "数字",
	boolean: "布尔值",
	datetime: "日期时间",
};

/**
 * Passed to `Select.Root`'s `items` prop so the closed trigger can resolve a
 * value to its label without first mounting the popup's `SelectItem`s (see
 * base-ui `Select.Root.Props.items`).
 */
const FIELD_TYPE_SELECT_ITEMS = (
	Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]
).map(([value, label]) => ({ value, label }));

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const createFieldFormSchema = z.object({
	name: z.string().trim().min(1, "名称不能为空"),
	key: z
		.string()
		.trim()
		.min(1, "标识不能为空")
		.regex(FIELD_KEY_PATTERN, "标识需以小写字母开头，仅含小写字母/数字/下划线"),
	type: z.enum(["text", "textarea", "number", "boolean", "datetime"]),
	required: z.boolean(),
	description: z.string().trim(),
});

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

function formatCreatedAt(value: string | Date): string {
	return CREATED_AT_FORMATTER.format(new Date(value));
}

function AdminFieldsPage() {
	const fieldsQuery = useQuery(trpc.userFields.list.queryOptions());
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	return (
		<div className="container mx-auto max-w-4xl px-4 py-6">
			<div className="mb-4 flex items-center justify-between gap-4">
				<div>
					<h1 className="cn-font-heading font-medium text-lg">字段管理</h1>
					<p className="text-muted-foreground text-sm">
						管理用户信息表的自定义字段定义
					</p>
				</div>
				<Dialog onOpenChange={setCreateDialogOpen} open={createDialogOpen}>
					<DialogTrigger render={<Button size="sm" type="button" />}>
						新增字段
					</DialogTrigger>
					<CreateFieldDialogContent
						onCreated={() => setCreateDialogOpen(false)}
					/>
				</Dialog>
			</div>

			<FieldListTable
				fields={(fieldsQuery.data as FieldDefinition[] | undefined) ?? []}
				isError={fieldsQuery.isError}
				isLoading={fieldsQuery.isLoading}
			/>
		</div>
	);
}

function CreateFieldDialogContent({ onCreated }: { onCreated: () => void }) {
	const queryClient = useQueryClient();
	const createFieldMutation = useMutation(
		trpc.userFields.create.mutationOptions()
	);

	const form = useForm({
		defaultValues: {
			name: "",
			key: "",
			type: "text" as FieldType,
			required: false,
			description: "",
		},
		onSubmit: async ({ value, formApi }) => {
			try {
				await createFieldMutation.mutateAsync({
					name: value.name,
					key: value.key,
					type: value.type,
					required: value.required,
					description: value.description.trim() || undefined,
				});
				await queryClient.invalidateQueries(trpc.userFields.list.queryFilter());
				toast.success("字段创建成功");
				formApi.reset();
				onCreated();
			} catch (error) {
				toast.error(getPdrErrorMessage(error, "创建字段失败"));
			}
		},
		validators: {
			onSubmit: createFieldFormSchema,
		},
	});

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle>新增字段</DialogTitle>
				<DialogDescription>
					定义一个新的用户自定义字段，标识创建后不可修改
				</DialogDescription>
			</DialogHeader>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>名称</Label>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
							{field.state.meta.errors.map((error) => (
								<p className="text-destructive text-xs" key={error?.message}>
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="key">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>标识（key）</Label>
							<Input
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="user_level"
								value={field.state.value}
							/>
							{field.state.meta.errors.map((error) => (
								<p className="text-destructive text-xs" key={error?.message}>
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="type">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>类型</Label>
							<Select
								items={FIELD_TYPE_SELECT_ITEMS}
								name={field.name}
								onValueChange={(value) =>
									field.handleChange(value as FieldType)
								}
								value={field.state.value}
							>
								<SelectTrigger className="w-full" id={field.name}>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{FIELD_TYPE_SELECT_ITEMS.map(({ value, label }) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
				</form.Field>

				<form.Field name="required">
					{(field) => (
						<label
							className="flex items-center gap-2 text-sm"
							htmlFor={field.name}
						>
							<Checkbox
								checked={field.state.value}
								id={field.name}
								onCheckedChange={(checked) =>
									field.handleChange(checked === true)
								}
							/>
							必填字段
						</label>
					)}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor={field.name}>描述（可选）</Label>
							<Textarea
								id={field.name}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								value={field.state.value}
							/>
						</div>
					)}
				</form.Field>

				<DialogFooter>
					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{({ canSubmit, isSubmitting }) => (
							<Button
								disabled={
									!canSubmit || isSubmitting || createFieldMutation.isPending
								}
								type="submit"
							>
								{createFieldMutation.isPending ? "创建中..." : "创建"}
							</Button>
						)}
					</form.Subscribe>
				</DialogFooter>
			</form>
		</DialogContent>
	);
}

function FieldListTable({
	fields,
	isLoading,
	isError,
}: {
	fields: FieldDefinition[];
	isError: boolean;
	isLoading: boolean;
}) {
	if (isLoading) {
		return (
			<div className="flex flex-col gap-2 p-4 ring-1 ring-foreground/10">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
			</div>
		);
	}

	if (isError) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyTitle>字段列表加载失败</EmptyTitle>
					<EmptyDescription>请刷新页面重试</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	if (fields.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<DatabaseZap />
					</EmptyMedia>
					<EmptyTitle>暂无自定义字段</EmptyTitle>
					<EmptyDescription>
						点击“新增字段”创建第一个自定义字段
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="overflow-x-auto ring-1 ring-foreground/10">
			<table className="w-full text-left text-xs/relaxed">
				<thead>
					<tr className="border-b bg-muted/40">
						<th className="px-4 py-2 font-medium" scope="col">
							名称
						</th>
						<th className="px-4 py-2 font-medium" scope="col">
							标识
						</th>
						<th className="px-4 py-2 font-medium" scope="col">
							类型
						</th>
						<th className="px-4 py-2 font-medium" scope="col">
							来源
						</th>
						<th className="px-4 py-2 font-medium" scope="col">
							创建时间
						</th>
						<th className="px-4 py-2 font-medium" scope="col">
							操作
						</th>
					</tr>
				</thead>
				<tbody>
					{fields.map((field) => (
						<FieldListRow field={field} key={field.id} />
					))}
				</tbody>
			</table>
		</div>
	);
}

function FieldListRow({ field }: { field: FieldDefinition }) {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const queryClient = useQueryClient();
	const deleteFieldMutation = useMutation(
		trpc.userFields.delete.mutationOptions()
	);

	const handleDelete = async () => {
		try {
			await deleteFieldMutation.mutateAsync({ id: field.id });
			await queryClient.invalidateQueries(trpc.userFields.list.queryFilter());
			toast.success("字段已删除");
			setConfirmOpen(false);
		} catch (error) {
			toast.error(getPdrErrorMessage(error, "删除字段失败"));
		}
	};

	return (
		<tr className="border-b last:border-b-0">
			<td className="px-4 py-2">{field.name}</td>
			<td className="px-4 py-2 font-mono text-muted-foreground">{field.key}</td>
			<td className="px-4 py-2">{FIELD_TYPE_LABELS[field.type]}</td>
			<td className="px-4 py-2">
				<span
					className={
						field.isSystem
							? "inline-flex items-center bg-muted px-2 py-0.5 text-foreground"
							: "inline-flex items-center bg-primary/10 px-2 py-0.5 text-primary"
					}
				>
					{field.isSystem ? "系统字段" : "自定义"}
				</span>
			</td>
			<td className="px-4 py-2 text-muted-foreground">
				{formatCreatedAt(field.createdAt)}
			</td>
			<td className="px-4 py-2">
				<Dialog onOpenChange={setConfirmOpen} open={confirmOpen}>
					<DialogTrigger
						render={
							<Button
								disabled={field.isSystem}
								size="xs"
								type="button"
								variant="destructive"
							/>
						}
					>
						删除
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>删除字段“{field.name}”？</DialogTitle>
							<DialogDescription>
								该操作会同时删除该字段关联的所有用户数据，且不可恢复。
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button
								onClick={() => setConfirmOpen(false)}
								type="button"
								variant="outline"
							>
								取消
							</Button>
							<Button
								disabled={deleteFieldMutation.isPending}
								onClick={handleDelete}
								type="button"
								variant="destructive"
							>
								{deleteFieldMutation.isPending ? "删除中..." : "确认删除"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</td>
		</tr>
	);
}
