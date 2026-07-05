# GitHub Token 获取个人账户信息与字段管理 PRD

## 1. 文档信息

| 项目 | 内容 |
| --- | --- |
| 产品名称 | GitHub Token 获取个人账户信息与字段管理 |
| 文档类型 | 产品需求文档（PRD） |
| 文档版本 | V1.0 |
| 当前状态 | 待评审 |
| 目标项目 | hl-aigc |

## 2. 项目背景

本产品提供一个简单的表单页面。用户输入自己的 GitHub Personal Access Token（以下简称 Token）后，系统调用 GitHub API 获取该 Token 所属账户的个人信息，并将标准化后的账户信息保存到数据库。

后台使用 Drizzle ORM 管理数据库表结构，并提供用户信息字段管理能力，管理员可新增或删除自定义字段，以满足后续业务对用户数据的扩展需求。

## 3. 产品目标

1. 让用户通过 Token 快速同步自己的 GitHub 个人账户信息。
2. 对同步结果进行持久化存储，并支持重复同步时更新已有数据。
3. 通过 Drizzle ORM 维护稳定、可追踪的数据库结构。
4. 支持管理员新增和删除用户信息的自定义字段。
5. 确保 Token 在传输、使用、日志和存储过程中的安全性。

## 4. 非目标范围

V1.0 暂不包含以下能力：

- GitHub OAuth 登录。
- 组织、仓库、提交、Issue、Pull Request 等数据同步。
- 多用户权限体系和复杂的角色管理。
- 自定义字段拖拽排序、分组、公式计算和字段级权限。
- GitHub Token 的长期托管、展示或导出。
- 自动定时同步 GitHub 数据。

## 5. 用户角色

### 5.1 普通用户

- 输入自己的 GitHub Token。
- 发起账户信息同步。
- 查看同步结果、成功提示或失败原因。

### 5.2 管理员

- 查看已保存的 GitHub 用户信息。
- 新增自定义字段。
- 删除允许删除的自定义字段。
- 查看字段的名称、标识、类型和创建时间。

> V1.0 若项目尚无登录与权限系统，字段管理页面可先作为受保护的内部页面交付，但不得暴露为无需鉴权的公开接口。

## 6. 核心用户流程

### 6.1 GitHub 账户信息同步

1. 用户进入表单页面。
2. 用户输入 GitHub Personal Access Token。
3. 前端完成必填和基本格式校验。
4. 用户点击“获取账户信息”。
5. 服务端使用 Token 请求 GitHub `GET /user` API。
6. 服务端校验响应并提取支持的账户字段。
7. 系统按 GitHub 用户 ID 判断记录是否已存在：
   - 不存在：创建用户记录。
   - 已存在：更新 GitHub 账户信息及同步时间。
8. 页面展示同步成功结果；Token 输入框立即清空。

### 6.2 新增自定义字段

1. 管理员进入字段管理页面。
2. 点击“新增字段”。
3. 填写字段名称、字段标识和字段类型。
4. 系统校验字段标识的格式及唯一性。
5. 保存字段定义，并通过 Drizzle 管理对应的数据结构或字段值模型。
6. 页面刷新字段列表并提示新增成功。

### 6.3 删除自定义字段

1. 管理员在字段列表点击“删除”。
2. 系统展示二次确认，并提示关联数据将被删除或不可恢复。
3. 管理员确认后，系统删除字段定义及其关联值。
4. 系统字段不可删除。

## 7. 功能需求

### 7.1 Token 输入表单

| 编号 | 需求 | 优先级 |
| --- | --- | --- |
| FR-01 | 页面提供 Token 密码输入框，默认隐藏输入内容 | P0 |
| FR-02 | 提供“显示/隐藏 Token”切换能力 | P1 |
| FR-03 | Token 为空时不可提交，并展示明确提示 | P0 |
| FR-04 | 提交期间按钮进入加载态，防止重复提交 | P0 |
| FR-05 | 请求结束后清空 Token，不在浏览器持久化 | P0 |
| FR-06 | 页面提示用户仅授予读取个人资料所需的最小权限 | P0 |

Token 兼容 classic PAT 和 fine-grained PAT。前端不依赖固定前缀作为唯一合法性判断，以避免 GitHub Token 格式变化导致误拦截。

### 7.2 GitHub API 调用

服务端调用 GitHub REST API：

- 方法：`GET`
- 路径：`https://api.github.com/user`
- 请求头：
  - `Authorization: Bearer <TOKEN>`
  - `Accept: application/vnd.github+json`
  - `X-GitHub-Api-Version: <项目采用的版本>`

系统应处理以下结果：

| 场景 | 产品行为 |
| --- | --- |
| Token 有效 | 保存数据并展示同步结果 |
| Token 无效或已过期 | 提示“Token 无效或已过期，请检查后重试” |
| 权限不足 | 提示“Token 权限不足，无法读取账户信息” |
| GitHub API 限流 | 提示稍后重试；服务端记录限流信息 |
| GitHub 服务异常 | 提示“GitHub 服务暂时不可用，请稍后重试” |
| 网络超时 | 请求终止并提供重试入口 |

### 7.3 账户信息字段

V1.0 建议保存以下 GitHub `GET /user` 返回字段：

| 系统字段 | GitHub 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| githubId | `id` | bigint/text | 是 | GitHub 用户唯一标识，唯一索引 |
| login | `login` | varchar | 是 | GitHub 用户名 |
| nodeId | `node_id` | varchar | 否 | GitHub GraphQL 节点 ID |
| avatarUrl | `avatar_url` | text | 否 | 头像地址 |
| htmlUrl | `html_url` | text | 否 | GitHub 主页地址 |
| name | `name` | varchar | 否 | 展示名称 |
| company | `company` | varchar | 否 | 公司 |
| blog | `blog` | text | 否 | 个人网站 |
| location | `location` | varchar | 否 | 所在地 |
| email | `email` | varchar | 否 | 公开邮箱；可能为空 |
| bio | `bio` | text | 否 | 个人简介 |
| twitterUsername | `twitter_username` | varchar | 否 | X/Twitter 用户名 |
| publicRepos | `public_repos` | integer | 是 | 公开仓库数 |
| publicGists | `public_gists` | integer | 是 | 公开 Gist 数 |
| followers | `followers` | integer | 是 | 粉丝数 |
| following | `following` | integer | 是 | 关注数 |
| githubCreatedAt | `created_at` | timestamp | 是 | GitHub 账户创建时间 |
| githubUpdatedAt | `updated_at` | timestamp | 是 | GitHub 账户更新时间 |
| syncedAt | 系统生成 | timestamp | 是 | 本系统最近同步时间 |

数据库还需包含本系统的 `id`、`createdAt` 和 `updatedAt`。

### 7.4 数据保存与更新

- 以 `githubId` 作为 GitHub 用户的幂等标识。
- 同一用户重复提交 Token 时更新原记录，不创建重复用户。
- GitHub 返回 `null` 的可选字段允许保存为空。
- 每次同步成功后更新 `syncedAt`。
- GitHub API 请求成功但数据库写入失败时，整体返回失败，不向用户显示“同步成功”。
- V1.0 默认不保存 Token；仅在当前请求内存中使用，完成后释放。

### 7.5 字段管理

自定义字段至少包含以下属性：

| 属性 | 说明 |
| --- | --- |
| name | 展示名称，例如“用户等级” |
| key | 稳定的程序标识，例如 `user_level` |
| type | 字段类型 |
| required | 是否必填；V1.0 默认否 |
| description | 字段说明，可选 |
| createdAt | 创建时间 |
| updatedAt | 更新时间 |

V1.0 支持的字段类型：

- 单行文本（text）
- 多行文本（textarea）
- 数字（number）
- 布尔值（boolean）
- 日期时间（datetime）

字段规则：

- `key` 仅允许小写字母、数字和下划线，且必须以字母开头。
- `key` 在字段定义表中全局唯一，创建后不可修改。
- GitHub 系统字段和数据库基础字段为保留字段，不允许新增同名字段或删除。
- 删除字段必须二次确认。
- 已产生数据的字段删除后，其关联值同步删除；建议在事务中完成。
- 字段新增和删除均应记录操作者、时间、字段标识和操作类型。

### 7.6 数据结构方案

为支持运行时新增和删除字段，V1.0 推荐使用“字段定义表 + 字段值表”，而不是每次操作都直接执行数据库 DDL。该方案仍由 Drizzle ORM 管理，风险更低，也更适合动态字段。

#### `github_users`

保存固定的 GitHub 系统字段，每个 GitHub 用户一条记录。

#### `user_field_definitions`

保存自定义字段定义，`key` 唯一。

#### `user_field_values`

保存用户与自定义字段的值，`userId + fieldDefinitionId` 建立唯一约束。字段删除时通过外键级联删除关联值。

#### `field_audit_logs`

保存字段新增和删除审计记录。

> 若业务明确要求“新增字段”必须真实修改 `github_users` 的数据库列，则应通过受控的 Drizzle migration 发布，而不是由公开运行时接口直接执行 DDL；该方式需要独立的变更审批、回滚和并发锁定设计。

### 7.7 页面与交互

#### 页面 A：GitHub 信息同步页

页面包含：

- 页面标题和简短用途说明。
- Token 密码输入框。
- 最小权限与安全提示。
- “获取账户信息”主按钮。
- 加载、成功、错误状态。
- 成功后展示头像、用户名、名称、个人主页、简介、公开仓库数、粉丝数和最近同步时间。

#### 页面 B：字段管理页

页面包含：

- 字段列表：名称、标识、类型、来源、创建时间、操作。
- “新增字段”按钮及表单。
- 删除操作和二次确认弹窗。
- 系统字段展示“系统字段”标识，删除按钮禁用或隐藏。
- 空状态、加载状态和操作结果提示。

## 8. 接口建议

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/github/sync-profile` | 使用 Token 获取并保存 GitHub 账户信息 |
| GET | `/api/github/users/:id` | 获取已保存的用户信息 |
| GET | `/api/user-fields` | 获取字段列表 |
| POST | `/api/user-fields` | 新增自定义字段 |
| DELETE | `/api/user-fields/:id` | 删除自定义字段 |

`POST /api/github/sync-profile` 请求体示例：

```json
{
  "token": "用户输入的 GitHub Token"
}
```

成功响应不得回传 Token：

```json
{
  "success": true,
  "data": {
    "id": "系统用户 ID",
    "githubId": "GitHub 用户 ID",
    "login": "octocat",
    "name": "The Octocat",
    "avatarUrl": "https://github.com/images/error/octocat_happy.gif",
    "htmlUrl": "https://github.com/octocat",
    "syncedAt": "2026-07-05T00:00:00.000Z"
  }
}
```

统一错误响应建议包含稳定错误码：

```json
{
  "success": false,
  "error": {
    "code": "GITHUB_TOKEN_INVALID",
    "message": "Token 无效或已过期，请检查后重试"
  }
}
```

建议错误码：`VALIDATION_ERROR`、`GITHUB_TOKEN_INVALID`、`GITHUB_PERMISSION_DENIED`、`GITHUB_RATE_LIMITED`、`GITHUB_UNAVAILABLE`、`DATABASE_ERROR`、`FIELD_KEY_CONFLICT`、`SYSTEM_FIELD_PROTECTED`、`FIELD_NOT_FOUND`。

## 9. 安全与隐私要求

1. 所有请求必须使用 HTTPS。
2. Token 不写入数据库、Cookie、localStorage、sessionStorage、分析平台或错误日志。
3. 服务端日志必须对 `Authorization` 请求头和 Token 字段进行脱敏。
4. 错误信息不得包含 Token、数据库连接信息或 GitHub 原始敏感响应。
5. 对同步接口实施频率限制，降低 Token 撞库和接口滥用风险。
6. 字段管理接口必须鉴权，并校验管理员权限。
7. 数据库使用参数化查询；所有输入通过服务端 schema 校验。
8. 页面提供隐私说明，告知用户将保存哪些 GitHub 账户信息。
9. 仅申请和使用完成功能所需的最小 GitHub Token 权限。

## 10. 非功能需求

| 类别 | 要求 |
| --- | --- |
| 性能 | 正常网络下，95% 的同步请求在 5 秒内完成 |
| 超时 | GitHub API 请求应设置合理超时，建议 10 秒以内 |
| 可用性 | 提交、加载、成功、空状态和失败状态均有明确反馈 |
| 兼容性 | 支持当前主流桌面和移动端浏览器 |
| 可观测性 | 记录请求 ID、结果状态、耗时和错误码，不记录 Token |
| 数据一致性 | 用户写入、自定义字段删除及关联值删除应使用事务 |
| 可维护性 | Drizzle schema、migration 和数据库实际结构保持一致 |

## 11. 验收标准

### 11.1 账户同步

- [ ] 输入有效 Token 后，系统能获取 GitHub 个人账户信息并保存到数据库。
- [ ] 页面能展示用户名、头像、主页等核心同步结果。
- [ ] 同一 GitHub 用户重复同步不会产生重复记录。
- [ ] 再次同步后，账户信息和 `syncedAt` 正确更新。
- [ ] 无效、过期、权限不足和被限流的 Token 均显示可理解的错误提示。
- [ ] Token 不出现在数据库、浏览器持久化存储、URL、响应结果或日志中。
- [ ] GitHub API 或数据库异常时不会错误展示同步成功。

### 11.2 字段管理

- [ ] 管理员能创建支持类型的自定义字段。
- [ ] 重复或非法字段标识无法创建，并显示明确提示。
- [ ] 新增字段后，可为用户保存对应类型的字段值。
- [ ] 管理员能在二次确认后删除自定义字段。
- [ ] 删除字段后，其关联值按设计同步清理。
- [ ] 系统字段无法被删除或被同名自定义字段覆盖。
- [ ] 未授权用户无法调用字段新增和删除接口。
- [ ] 新增、删除字段操作具有可追踪的审计记录。

## 12. 测试重点

- classic PAT、fine-grained PAT、无效 Token、过期 Token。
- GitHub 用户的可选字段为空或超长。
- 同一用户连续提交和并发提交。
- GitHub API 超时、限流、5xx 响应。
- 数据库写入失败和事务回滚。
- 自定义字段 key 的边界值、重复值和保留字。
- 删除包含大量关联值的字段。
- Token 在前端、服务端、反向代理和监控日志中的泄漏检查。
- 字段管理接口的越权访问。

## 13. 里程碑建议

1. **M1：数据层**——完成 Drizzle schema、migration、约束和种子数据。
2. **M2：同步接口**——完成 GitHub API 接入、数据映射、幂等写入和错误处理。
3. **M3：同步页面**——完成 Token 表单、状态反馈和结果展示。
4. **M4：字段管理**——完成字段定义、字段值、增删接口和管理页面。
5. **M5：安全与验收**——完成权限、限流、日志脱敏、自动化测试和验收。

## 14. 待确认事项

1. `hl-aigc` 当前使用的数据库类型（PostgreSQL、MySQL 或 SQLite）。
2. 项目是否已有登录、管理员角色和权限中间件。
3. 自定义字段是否需要由用户录入值，还是仅管理字段定义。
4. 删除字段是否要求软删除和恢复能力；本 PRD V1.0 默认硬删除并记录审计日志。
5. 是否需要保存 Token 以支持定时同步；本 PRD V1.0 默认不保存，以降低安全风险。
6. “新增/删除字段”是否必须真实修改数据库列；本 PRD推荐动态字段模型。

