# Frontend Pages

## 0. 前端无 mock 规则

前端页面必须接入真实后端接口后才能进入菜单和路由。

- 不允许使用占位页表示功能完成。
- 不允许预填演示账号密码。
- 不允许在页面内写死表格、通知、AI 回复或业务记录。
- 菜单必须来自 `/api/v1/auth/me` 返回的真实权限菜单。
- 未完成页面可以保留在规划文档中，但不能注册到运行时路由或菜单。

## 1. 前端目标

前端不是普通页面集合，而是企业后台可复制模板。

原则：
- 每个页面展示一种典型企业能力。
- 页面结构统一。
- API 类型来自 OpenAPI。
- 服务端数据交给 TanStack Query。
- 全局用户、菜单、权限交给 Zustand。
- 复杂 CRUD 优先使用 Ant Design ProComponents。

## 2. 布局

### AuthLayout

页面：
- `/login`

能力：
- 登录。
- 记住账号。
- 登录失败提示。
- Token 保存。

### BasicLayout

页面：
- 所有后台页面。

能力：
- 顶部栏。
- 侧边菜单。
- 面包屑。
- 用户菜单。
- 主题切换。
- 通知入口。
- 路由权限守卫。

菜单来源：
- 登录后调用 `/api/v1/auth/me`。
- 从后端菜单树生成侧边菜单。
- 根据权限码控制页面和按钮。

## 3. 页面规划

### `/dashboard`

名称：
- 工作台

展示能力：
- 统计卡片。
- 图表。
- 待办事项。
- WebSocket 实时通知。

组件：
- StatisticCard
- RecentActivities
- TodoList
- NotificationBell

### `/system/users`

名称：
- 用户管理

展示能力：
- 普通 CRUD。
- 分页。
- 搜索。
- 新增弹窗。
- 编辑弹窗。
- 删除确认。
- 启用/禁用。
- 重置密码。
- 按钮权限。

建议：
- 使用 ProTable + ModalForm。

权限码：
- user:view
- user:create
- user:update
- user:delete
- user:reset_password

### `/system/roles`

名称：
- 角色管理

展示能力：
- 角色 CRUD。
- 菜单树授权。
- 按钮权限授权。
- data_scope 配置。

组件：
- RoleTable
- RoleForm
- PermissionTree
- DataScopeSelector

### `/system/menus`

名称：
- 菜单管理

展示能力：
- 菜单树。
- 页面权限。
- 按钮权限。
- 动态路由元数据。

菜单类型：
- directory
- page
- button

### `/system/departments`

名称：
- 部门管理

展示能力：
- 树形组织。
- 部门 CRUD。
- 父子级关系。

建议：
- 使用 AntD Tree + DrawerForm。

### `/business/customers`

名称：
- 客户管理

展示能力：
- 高级查询列表。
- 数据权限。
- 批量操作。
- 导出。

数据权限演示：
- admin 看全部。
- manager 看本部门。
- staff 看本人创建。

建议：
- 页面顶部显示当前账号的数据范围，便于 demo 展示。

### `/business/orders`

名称：
- 订单管理

展示能力：
- 主子表。
- 复杂表单。
- 明细行动态增删。
- 金额自动计算。
- 事务保存。

页面：
- OrderList
- OrderCreate
- OrderEdit
- OrderDetail

### `/business/tasks`

名称：
- 任务管理

展示能力：
- 状态流转。
- 状态机限制。
- 待办分配。

状态：
- DRAFT
- TODO
- DOING
- DONE
- CLOSED

### `/workflow/approvals`

名称：
- 审批中心

展示能力：
- 审批列表。
- 审批详情。
- 通过。
- 驳回。
- 审批时间线。

### `/realtime/messages`

名称：
- 实时消息

展示能力：
- WebSocket 连接状态。
- 未读消息。
- 在线状态。
- 通知实时推送。

### `/ai/chat`

名称：
- AI 助手

展示能力：
- SSE 流式输出。
- 停止生成。
- 会话列表。
- 消息保存。
- 业务上下文摘要。

快捷能力：
- 总结当前客户。
- 生成订单备注。
- 解释审批驳回原因。
- 生成任务拆解建议。

### `/files`

名称：
- 文件中心

展示能力：
- 上传。
- 下载。
- 预览。
- 删除。
- 关联业务对象。

### `/logs/operation`

名称：
- 操作日志

展示能力：
- 审计日志。
- 操作人。
- 操作对象。
- 请求路径。
- 操作结果。
- request_id。

### `/settings`

名称：
- 系统配置

展示能力：
- 参数配置。
- AI 配置。
- 通知开关。
- 缓存刷新。

### `/profile`

名称：
- 个人中心

展示能力：
- 用户信息。
- 修改密码。
- 登录设备。

## 4. 前端基础组件

建议内置：
- Permission：按钮权限组件。
- PageContainer：页面容器。
- SearchTable：标准查询表格封装。
- ConfirmButton：确认操作按钮。
- StatusTag：状态标签。
- UserSelect：用户选择器。
- DepartmentTreeSelect：部门选择器。
- FileUploader：文件上传。
- AuditLogDrawer：操作日志抽屉。
- StreamMessage：SSE 流式消息展示。

## 5. 数据流规范

接口数据：
- TanStack Query。

示例：
- `useUsers`
- `useCreateUser`
- `useUpdateUser`
- `useDeleteUser`

全局状态：
- Zustand。

内容：
- currentUser
- permissions
- menus
- theme
- notificationUnreadCount

权限：
- 前端隐藏无权限按钮。
- 后端必须再次校验。

## 6. 页面实现顺序

第一批：
- Login
- BasicLayout
- Dashboard
- UserManagement

第二批：
- RoleManagement
- MenuManagement
- DepartmentManagement

第三批：
- CustomerManagement
- OrderManagement
- TaskManagement

第四批：
- ApprovalCenter
- RealtimeMessages
- AIChat
- FileCenter
- AuditLogs
- Settings
