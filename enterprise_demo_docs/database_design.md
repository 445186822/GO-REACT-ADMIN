# Database Design

## 1. 设计原则

数据库以 PostgreSQL 为主。

原则：
- 所有核心业务表都有 `id`、`created_at`、`updated_at`。
- 可删除业务表使用软删除：`deleted_at`。
- 企业权限使用 RBAC + Data Scope。
- SQLC 查询必须显式处理软删除和数据权限。
- 复杂查询优先清晰 SQL，不依赖 ORM 魔法。
- 必要时用 View 或 PostgreSQL RLS 降低数据权限遗漏风险。

## 2. 通用字段规范

推荐基础字段：

```sql
id BIGSERIAL PRIMARY KEY,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
deleted_at TIMESTAMPTZ NULL
```

软删除过滤：

```sql
WHERE deleted_at IS NULL
```

软删除操作：

```sql
UPDATE table_name
SET deleted_at = now(), updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;
```

## 3. 系统表

### sys_users

用途：
- 登录用户、后台账号、业务归属人。

核心字段：
- id
- username
- password_hash
- display_name
- email
- phone
- status
- department_id
- is_super_admin
- last_login_at
- created_at
- updated_at
- deleted_at

### sys_roles

用途：
- 角色定义。

核心字段：
- id
- code
- name
- description
- status
- created_at
- updated_at
- deleted_at

### sys_user_roles

用途：
- 用户和角色多对多。

核心字段：
- user_id
- role_id
- created_at

### sys_menus

用途：
- 菜单、页面、按钮权限统一建模。

核心字段：
- id
- parent_id
- type: directory/page/button
- code
- name
- path
- component
- icon
- sort_order
- visible
- status
- created_at
- updated_at
- deleted_at

说明：
- 页面权限和按钮权限都通过 `code` 控制。
- 前端根据后端返回菜单树和权限码生成菜单、路由和按钮显示。

### sys_role_menus

用途：
- 角色授权。

核心字段：
- role_id
- menu_id
- data_scope
- created_at

data_scope 建议枚举：
- ALL：全部数据。
- DEPT：本部门数据。
- DEPT_AND_CHILD：本部门及子部门。
- SELF：本人数据。
- CUSTOM：自定义部门。

### sys_departments

用途：
- 组织架构。

核心字段：
- id
- parent_id
- name
- code
- sort_order
- status
- created_at
- updated_at
- deleted_at

### sys_settings

用途：
- 系统参数配置、AI 配置、通知开关。

核心字段：
- id
- group_key
- setting_key
- setting_value
- value_type
- description
- is_encrypted
- created_at
- updated_at

### sys_audit_logs

用途：
- 操作审计。

核心字段：
- id
- request_id
- user_id
- username
- action
- resource
- resource_id
- method
- path
- ip
- user_agent
- request_body
- response_code
- success
- error_message
- created_at

## 4. 业务示例表

### biz_customers

用途：
- 展示普通 CRUD、高级查询、数据权限。

核心字段：
- id
- name
- level
- phone
- email
- owner_id
- department_id
- status
- remark
- created_at
- updated_at
- deleted_at

数据权限：
- ALL：不过滤 owner/department。
- DEPT：`department_id = current_user.department_id`。
- SELF：`owner_id = current_user.id`。

### biz_orders

用途：
- 展示主子表、事务保存。

核心字段：
- id
- order_no
- customer_id
- owner_id
- department_id
- status
- total_amount
- remark
- created_at
- updated_at
- deleted_at

### biz_order_items

用途：
- 订单明细。

核心字段：
- id
- order_id
- product_name
- quantity
- unit_price
- amount
- sort_order
- created_at
- updated_at

### biz_tasks

用途：
- 展示状态流转。

核心字段：
- id
- title
- description
- assignee_id
- owner_id
- department_id
- status
- due_at
- completed_at
- created_at
- updated_at
- deleted_at

状态：
- DRAFT
- TODO
- DOING
- DONE
- CLOSED

### biz_approvals

用途：
- 展示审批流程。

核心字段：
- id
- biz_type
- biz_id
- applicant_id
- current_approver_id
- status
- submitted_at
- completed_at
- created_at
- updated_at

### biz_approval_records

用途：
- 审批时间线。

核心字段：
- id
- approval_id
- approver_id
- action
- comment
- created_at

### sys_notifications

用途：
- WebSocket 实时通知。

核心字段：
- id
- user_id
- title
- content
- type
- read_at
- created_at

### ai_chat_sessions

用途：
- AI 助手会话。

核心字段：
- id
- user_id
- title
- created_at
- updated_at
- deleted_at

### ai_chat_messages

用途：
- AI 消息记录。

核心字段：
- id
- session_id
- role
- content
- token_count
- created_at

### sys_files

用途：
- 文件中心。

核心字段：
- id
- original_name
- storage_path
- mime_type
- size
- uploader_id
- biz_type
- biz_id
- created_at
- deleted_at

## 5. SQLC 查询规范

每个模块维护自己的 `queries.sql`。

规则：
- 查询必须显式写软删除条件。
- 列表查询必须带分页。
- 数据权限查询必须通过参数显式传入。
- 不使用 `SELECT *`，避免接口字段不可控。
- 复杂 JOIN 可使用 `sqlc.embed()`。

示例：

```sql
-- name: ListCustomers :many
SELECT
  id,
  name,
  level,
  phone,
  email,
  owner_id,
  department_id,
  status,
  created_at,
  updated_at
FROM biz_customers
WHERE deleted_at IS NULL
  AND (@keyword::text = '' OR name ILIKE '%' || @keyword || '%')
  AND (
    @scope::text = 'ALL'
    OR (@scope::text = 'DEPT' AND department_id = @department_id)
    OR (@scope::text = 'SELF' AND owner_id = @user_id)
  )
ORDER BY created_at DESC
LIMIT @limit_count OFFSET @offset_count;
```

## 6. 数据权限建议

第一版用应用层参数控制：
- service 计算当前用户数据范围。
- repository/SQLC 查询接收 scope 参数。

后续可扩展：
- PostgreSQL View：统一软删除过滤。
- PostgreSQL RLS：把数据权限下沉到数据库。
- 自定义部门范围表：支持 CUSTOM data scope。
