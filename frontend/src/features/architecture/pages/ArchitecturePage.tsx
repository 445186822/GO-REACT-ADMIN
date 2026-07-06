import {
  ApiOutlined,
  ApartmentOutlined,
  BellOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  FormOutlined,
  LoginOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  TableOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, Col, Collapse, Row, Segmented, Space, Table, Tabs, Tag, Timeline, Typography } from 'antd';
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';

const { Paragraph, Text } = Typography;

type ArchitectureLayer = 'browser' | 'frontend' | 'state' | 'http' | 'backend' | 'data' | 'async';

type ArchitectureNodeData = Record<string, unknown> & {
  title: string;
  subtitle: string;
  layer: ArchitectureLayer;
  icon: ReactNode;
  files: string[];
  methods: string[];
  purpose: string;
  troubleshooting: string[];
};

type ArchitectureFlowNode = Node<ArchitectureNodeData, 'architectureNode'>;
type ArchitectureFlowEdge = Edge<{ label?: string }>;

type FlowDefinition = {
  key: string;
  label: string;
  summary: string;
  tags: string[];
  nodes: ArchitectureFlowNode[];
  edges: ArchitectureFlowEdge[];
  timeline: Array<[string, string]>;
};

type FlowInsight = {
  focus: string[];
  apis: string[];
  data: string[];
  checks: string[];
};

const LAYER_META: Record<ArchitectureLayer, { label: string; color: string; bg: string }> = {
  browser: { label: '浏览器', color: '#08979c', bg: '#e6fffb' },
  frontend: { label: '前端应用', color: '#1677ff', bg: '#eff6ff' },
  state: { label: '状态与权限', color: '#389e0d', bg: '#f0fdf4' },
  http: { label: '请求链路', color: '#d48806', bg: '#fff7e6' },
  backend: { label: '后端服务', color: '#722ed1', bg: '#f9f0ff' },
  data: { label: '数据层', color: '#cf1322', bg: '#fff1f0' },
  async: { label: '异步能力', color: '#c41d7f', bg: '#fff0f6' },
};

const FLOW_DEFINITIONS: FlowDefinition[] = [
  {
    key: 'overview',
    label: '系统总览',
    summary: '按浏览器、前端应用、请求层、后端中间件、业务模块、数据层拆开主链路，适合先判断问题大致落在哪一层。',
    tags: ['全局拓扑', '主请求链路', '菜单来源'],
    nodes: [
      node('browser', 0, 40, brief('浏览器', '访问后台页面', 'browser', <CloudServerOutlined />, ['Chrome / Edge'], ['输入 URL', '保存 localStorage'], '承载后台页面、token 持久化和接口请求。', ['先看控制台报错和 Network。'])),
      node('main', 260, 40, brief('React 启动', 'main.tsx', 'frontend', <CodeOutlined />, ['frontend/src/main.tsx'], ['createRoot().render()'], '挂载 React 根应用并进入路由系统。', ['白屏先看根组件是否加载。'])),
      node('router', 520, 40, brief('AppRouter', '认证守卫 / lazy routes', 'frontend', <BranchesOutlined />, ['frontend/src/routes/AppRouter.tsx', 'frontend/src/routes/lazyRoutes.ts'], ['AuthBootstrap()', 'RequireAuth()', 'enterpriseRoutes'], '根据登录态决定是否进入后台，并把懒加载页面注册成路由。', ['404 时先查 lazyRoutes。'])),
      node('layout', 780, 40, brief('BasicLayout', '菜单 / 标签页', 'frontend', <ApartmentOutlined />, ['frontend/src/layouts/BasicLayout.tsx'], ['toMenuItem()', 'findActiveMenuKeys()'], '渲染后台框架、菜单、标签页和当前页面出口。', ['菜单高亮异常看 path 是否一致。'])),
      node('api', 780, 290, brief('前端 API', 'api/*.ts', 'http', <ApiOutlined />, ['frontend/src/api/*.ts'], ['listUsers()', 'listMenus()', 'submitApprovalAction()'], '每个模块自己的接口封装层。', ['参数错时对照后端 request struct。'])),
      node('http', 520, 290, brief('HTTP 拦截器', 'token / role / refresh', 'http', <CloudServerOutlined />, ['frontend/src/request/http.ts'], ['request interceptor', 'response interceptor'], '统一加 Authorization、X-Active-Role，并处理 401 刷新。', ['401 循环重点看 refresh token。'])),
      node('server', 260, 290, brief('Echo Server', '/api/v1', 'backend', <CloudServerOutlined />, ['backend/internal/http/server.go'], ['NewServer()', 'Register(api)'], '挂载全局中间件并注册各业务模块。', ['接口 404 看 Register 是否接入。'])),
      node('permission', 0, 290, brief('权限中间件', 'Auth / RequirePermission', 'backend', <SafetyCertificateOutlined />, ['backend/internal/http/middleware/auth.go', 'backend/internal/http/middleware/route_permissions.go'], ['Auth()', 'RequirePermission()', 'PermissionForRequest()'], '解析用户、识别角色、按路径映射权限码并校验。', ['403 先查 PermissionForRequest。'])),
      node('handler', 260, 540, brief('模块 Handler', 'modules/<domain>', 'backend', <ApiOutlined />, ['backend/internal/modules/<domain>/handler.go'], ['Register()', 'List/Create/Update/Delete'], '承接业务逻辑并查询数据库。', ['500 看 handler 中 SQL 和 Scan。'])),
      node('db', 520, 540, brief('PostgreSQL', '业务表 / 系统表', 'data', <DatabaseOutlined />, ['backend/migrations/*.sql'], ['Query()', 'Exec()', 'QueryRow()'], '保存用户、菜单、业务数据、流程实例和日志。', ['数据缺失时查迁移和种子。'])),
      node('seed', 780, 540, brief('菜单种子', 'sys_menus', 'data', <TableOutlined />, ['backend/internal/database/database.go'], ['seedMenusSQL', 'Seed()'], '后台菜单和权限的基础数据来源。', ['菜单不显示看 sys_menus / sys_role_menus。'])),
    ],
    edges: [
      edge('browser', 'main', '加载 SPA'),
      edge('main', 'router', '进入路由'),
      edge('router', 'layout', '通过认证'),
      edge('layout', 'api', '页面动作'),
      edge('api', 'http', 'axios'),
      edge('http', 'server', '/api/v1'),
      edge('server', 'permission', '中间件'),
      edge('permission', 'handler', '放行'),
      edge('handler', 'db', 'SQL'),
      edge('db', 'seed', '菜单/权限'),
    ],
    timeline: [
      ['浏览器加载后台', '进入 main.tsx，React 应用开始挂载。'],
      ['路由认证', 'AppRouter 判断 token 并拉取当前用户。'],
      ['布局渲染', 'BasicLayout 使用后端菜单树生成导航。'],
      ['业务请求', '页面通过 api/*.ts 调用 http.ts。'],
      ['后端校验', 'Echo 中间件完成审计、认证、权限判断。'],
      ['模块处理', 'handler.go 执行 SQL 并返回统一响应。'],
    ],
  },
  {
    key: 'login',
    label: '登录菜单',
    summary: '展开登录、token、/auth/me、角色选择、菜单树构造和前端菜单渲染，是排查“登录后菜单不对”的主流程。',
    tags: ['登录', '菜单树', '角色切换'],
    nodes: [
      node('login-page', 0, 50, brief('LoginPage', '账号 / 验证码', 'frontend', <LoginOutlined />, ['frontend/src/features/auth/pages/LoginPage.tsx'], ['handleSubmit()', 'loginApi()'], '收集登录表单并调用登录接口。', ['登录失败先看表单校验和验证码。'])),
      node('login-api', 260, 50, brief('loginApi', 'POST /auth/login', 'http', <ApiOutlined />, ['frontend/src/api/auth.ts'], ['loginApi()'], '向后端提交账号密码和验证码 token。', ['确认请求体字段与 LoginRequest 一致。'])),
      node('login-handler', 520, 50, brief('Login()', '校验用户与密码', 'backend', <SafetyCertificateOutlined />, ['backend/internal/modules/auth/handler.go'], ['Login()', 'consumeCaptchaToken()', 'bcrypt.CompareHashAndPassword()'], '校验验证码、用户状态、密码并生成 token。', ['401/400 看验证码和密码 hash。'])),
      node('sign-token', 780, 50, brief('token.Sign', 'access / refresh', 'backend', <CodeOutlined />, ['backend/internal/auth/token.go'], ['Sign()'], '签发访问令牌和刷新令牌。', ['token 异常看 JWT secret 配置。'])),
      node('set-session', 1040, 50, brief('authStore.setSession', '保存登录态', 'state', <SafetyCertificateOutlined />, ['frontend/src/store/authStore.ts'], ['setSession()', 'resolveActiveRoleCode()'], '保存 token、用户、角色和初始菜单。', ['刷新后丢失看 persist storage。'])),
      node('auth-bootstrap', 1040, 300, brief('AuthBootstrap', '刷新当前用户', 'frontend', <BranchesOutlined />, ['frontend/src/routes/AppRouter.tsx'], ['AuthBootstrap()', 'meApi()'], '已有 token 时重新拉取 /auth/me，保证权限和菜单最新。', ['登录后空白看 /auth/me 是否失败。'])),
      node('me-api', 780, 300, brief('meApi', 'GET /auth/me', 'http', <ApiOutlined />, ['frontend/src/api/auth.ts'], ['meApi()'], '请求当前用户、权限码和菜单树。', ['Network 里看 menus/permissions。'])),
      node('current-user', 520, 300, brief('currentUser', '角色 / 权限 / 菜单', 'backend', <UserSwitchOutlined />, ['backend/internal/modules/auth/handler.go'], ['Me()', 'currentUser()', 'selectActiveRole()'], '根据 X-Active-Role 选择角色，查询该角色拥有的菜单。', ['角色切换不生效看 X-Active-Role。'])),
      node('menu-sql', 260, 300, brief('sys_role_menus', '角色菜单关联', 'data', <DatabaseOutlined />, ['backend/internal/modules/auth/handler.go', 'backend/internal/database/database.go'], ['buildTree()', 'seedMenusSQL'], '读取角色菜单和按钮权限，目录/页面构造成树。', ['菜单缺失查角色是否绑定菜单。'])),
      node('layout-menu', 0, 300, brief('BasicLayout 菜单', 'Ant Design Menu', 'frontend', <ApartmentOutlined />, ['frontend/src/layouts/BasicLayout.tsx'], ['toMenuItem()', 'flattenPageMenus()'], '把后端菜单树转换成侧边栏和顶部搜索选项。', ['path 不一致会导致点击或高亮异常。'])),
    ],
    edges: [
      edge('login-page', 'login-api', '提交'),
      edge('login-api', 'login-handler', 'POST'),
      edge('login-handler', 'sign-token', '通过'),
      edge('sign-token', 'set-session', '返回 token'),
      edge('set-session', 'auth-bootstrap', '进入后台'),
      edge('auth-bootstrap', 'me-api', '拉取当前用户'),
      edge('me-api', 'current-user', 'GET'),
      edge('current-user', 'menu-sql', '查询菜单'),
      edge('menu-sql', 'layout-menu', 'menus tree'),
    ],
    timeline: [
      ['提交登录', 'LoginPage 调用 loginApi。'],
      ['后端校验', 'Login 校验验证码、密码、用户状态。'],
      ['保存会话', 'authStore 持久化 token 和用户信息。'],
      ['拉取当前用户', 'AuthBootstrap 调 meApi 获取最新菜单。'],
      ['构造菜单树', 'currentUser 查询 sys_menus 后 buildTree。'],
      ['渲染菜单', 'BasicLayout 把菜单树转换为 Menu items。'],
    ],
  },
  {
    key: 'permission',
    label: '权限校验',
    summary: '覆盖前端权限显示、当前角色请求头、后端路径权限映射和角色菜单校验，是排查 403 的主图。',
    tags: ['403', '角色', '权限码'],
    nodes: [
      node('permission-component', 0, 60, brief('Permission 组件', '按钮显隐', 'frontend', <SafetyCertificateOutlined />, ['frontend/src/components/Permission.tsx'], ['hasPermission()'], '前端基于 permissions 控制按钮和局部 UI。', ['按钮不显示先看 permissions。'])),
      node('auth-store', 260, 60, brief('authStore', 'activeRoleCode', 'state', <UserSwitchOutlined />, ['frontend/src/store/authStore.ts'], ['setActiveRoleCode()', 'hasPermission()'], '保存当前角色和权限码。', ['切角色后确认 activeRoleCode。'])),
      node('http-role', 520, 60, brief('X-Active-Role', '请求头', 'http', <CloudServerOutlined />, ['frontend/src/request/http.ts'], ['request interceptor'], '每个受保护请求带上当前角色编码。', ['Network 请求头里确认是否存在。'])),
      node('auth-mw', 780, 60, brief('Auth()', '解析 JWT', 'backend', <SafetyCertificateOutlined />, ['backend/internal/http/middleware/auth.go'], ['Auth()', 'CurrentUserID()', 'ActiveRoleCode()'], '解析用户身份并把角色请求头放入上下文。', ['401 看 token 是否有效。'])),
      node('perm-map', 780, 310, brief('PermissionForRequest', 'path -> permission', 'backend', <BranchesOutlined />, ['backend/internal/http/middleware/route_permissions.go'], ['PermissionForRequest()', 'permissionByMethod()'], '按 method 和 path 计算所需权限码。', ['新增接口漏映射会默认拒绝。'])),
      node('perm-query', 520, 310, brief('RequirePermission', '查询角色授权', 'backend', <CheckCircleOutlined />, ['backend/internal/http/middleware/auth.go'], ['RequirePermission()'], '查询当前用户角色是否拥有权限码。', ['403 看角色绑定菜单。'])),
      node('role-menu', 260, 310, brief('sys_role_menus', '角色菜单', 'data', <DatabaseOutlined />, ['backend/migrations/*.sql', 'backend/internal/database/database.go'], ['seedDemoApproverRoleMenusSQL', 'seedMenusSQL'], '保存角色和菜单权限的授权关系。', ['确认 role_id/menu_id 是否存在。'])),
      node('handler', 0, 310, brief('业务 Handler', '通过后执行', 'backend', <ApiOutlined />, ['backend/internal/modules/<domain>/handler.go'], ['List/Create/Update/Delete'], '权限通过后执行真正业务逻辑。', ['如果已进 handler，则不是 403 层问题。'])),
    ],
    edges: [
      edge('permission-component', 'auth-store', '读取权限'),
      edge('auth-store', 'http-role', '当前角色'),
      edge('http-role', 'auth-mw', '请求头'),
      edge('auth-mw', 'perm-map', 'method/path'),
      edge('perm-map', 'perm-query', '权限码'),
      edge('perm-query', 'role-menu', 'SQL'),
      edge('role-menu', 'handler', '授权通过'),
    ],
    timeline: [
      ['前端显示控制', 'Permission 和 hasPermission 仅控制 UI。'],
      ['请求携带角色', 'http.ts 写入 X-Active-Role。'],
      ['后端解析身份', 'Auth 解析 JWT 和角色上下文。'],
      ['路径映射权限', 'PermissionForRequest 返回权限码。'],
      ['查询授权关系', 'RequirePermission 查询角色菜单。'],
      ['进入业务逻辑', '通过后才进入模块 handler。'],
    ],
  },
  {
    key: 'crud',
    label: '业务 CRUD',
    summary: '以用户/客户/字典等列表页为模板，展示 ProTable、api 封装、http 拦截器、handler、SQL、导出下载的典型链路。',
    tags: ['列表', '表单', '导出'],
    nodes: [
      node('table-page', 0, 50, brief('列表页面', 'ProTable request', 'frontend', <TableOutlined />, ['frontend/src/features/customer/pages/CustomerListPage.tsx', 'frontend/src/features/user/pages/UserListPage.tsx'], ['request', 'handleSave()', 'confirmDelete()'], '承载列表查询、筛选、表单提交和删除确认。', ['表格无数据看 request 返回结构。'])),
      node('permission-ui', 260, 50, brief('按钮权限', 'Permission', 'frontend', <SafetyCertificateOutlined />, ['frontend/src/components/Permission.tsx'], ['hasPermission()'], '按权限码控制创建、编辑、删除按钮。', ['按钮缺失看角色权限。'])),
      node('api-file', 520, 50, brief('模块 API', 'api/customers.ts', 'http', <ApiOutlined />, ['frontend/src/api/customers.ts', 'frontend/src/api/users.ts'], ['listCustomers()', 'createCustomer()', 'updateCustomer()', 'deleteCustomer()'], '封装 CRUD 请求路径和参数类型。', ['路径和字段名以这里为前端源头。'])),
      node('http', 780, 50, brief('HTTP 层', 'axios instance', 'http', <CloudServerOutlined />, ['frontend/src/request/http.ts'], ['http.get()', 'http.post()', 'http.put()', 'http.delete()'], '统一处理 token、角色、401 和时间字段。', ['接口返回格式异常看拦截器。'])),
      node('route-perm', 780, 300, brief('路由权限', 'method/path', 'backend', <BranchesOutlined />, ['backend/internal/http/middleware/route_permissions.go'], ['PermissionForRequest()'], 'GET/POST/PUT/DELETE 映射到不同权限码。', ['POST 403 查 create 权限。'])),
      node('domain-handler', 520, 300, brief('Domain Handler', 'handler.go', 'backend', <FormOutlined />, ['backend/internal/modules/customer/handler.go', 'backend/internal/modules/user/handler.go'], ['List()', 'Create()', 'Update()', 'Delete()'], '解析参数、执行查询、返回分页或结果。', ['Scan 报错看 SQL 字段顺序。'])),
      node('scope', 260, 300, brief('数据范围', 'role data_scope', 'backend', <UserSwitchOutlined />, ['backend/internal/modules/customer/handler.go'], ['data scope query'], '客户等业务模块可能按角色数据范围过滤。', ['看不到数据但无报错时查 data_scope。'])),
      node('db', 0, 300, brief('业务表', 'biz_* / sys_*', 'data', <DatabaseOutlined />, ['backend/migrations/*.sql'], ['SELECT', 'INSERT', 'UPDATE', 'DELETE'], '保存业务实体和系统实体。', ['确认数据是否真的写入。'])),
      node('export', 260, 550, brief('导出下载', 'ExportButton', 'frontend', <DownloadOutlined />, ['frontend/src/components/ExportButton.tsx', 'backend/internal/exportxlsx/xlsx.go'], ['exportExcel()', 'BackendDownloadButton'], '前端或后端生成 xlsx 文件。', ['导出异常看 Content-Type 和文件流。'])),
    ],
    edges: [
      edge('table-page', 'permission-ui', '按钮区'),
      edge('permission-ui', 'api-file', '触发动作'),
      edge('api-file', 'http', 'HTTP'),
      edge('http', 'route-perm', 'method/path'),
      edge('route-perm', 'domain-handler', '权限通过'),
      edge('domain-handler', 'scope', '数据过滤'),
      edge('scope', 'db', 'SQL'),
      edge('table-page', 'export', '导出'),
      edge('export', 'domain-handler', '可走后端导出'),
    ],
    timeline: [
      ['页面触发', 'ProTable request 或表单 submit。'],
      ['API 封装', 'api/*.ts 组装请求路径和参数。'],
      ['权限校验', '后端按 method/path 计算权限。'],
      ['业务处理', 'handler 解析参数并执行 SQL。'],
      ['数据范围', '部分模块按角色 data_scope 过滤。'],
      ['返回渲染', '页面刷新表格或提示操作结果。'],
    ],
  },
  {
    key: 'workflow',
    label: '工作流审批',
    summary: '展示工作流定义、审批实例、运行时节点、待办和通知之间的链路，用来排查流程卡住、状态不一致、待办不出现。',
    tags: ['审批', '待办', '业务状态'],
    nodes: [
      node('workflow-page', 0, 50, brief('WorkflowPage', '流程设计器', 'frontend', <BranchesOutlined />, ['frontend/src/features/collaboration/pages/WorkflowPage.tsx'], ['createWorkflow()', 'updateWorkflow()', 'runWorkflow()'], '维护工作流定义、节点、连线和业务状态映射。', ['流程定义异常先看 nodes/edges JSON。'])),
      node('approval-page', 260, 50, brief('ApprovalCenterPage', '提交 / 审批', 'frontend', <CheckCircleOutlined />, ['frontend/src/features/collaboration/pages/ApprovalCenterPage.tsx'], ['createInstance()', 'submitAction()'], '提交审批实例、处理通过/拒绝动作。', ['按钮不显示看 approval:* 权限。'])),
      node('collab-api', 520, 50, brief('collaboration API', 'api/collaboration.ts', 'http', <ApiOutlined />, ['frontend/src/api/collaboration.ts'], ['listWorkflows()', 'createApprovalInstance()', 'actionApproval()'], '封装协同办公所有 HTTP 接口。', ['接口路径集中在这里核对。'])),
      node('collab-handler', 780, 50, brief('collaboration handler', '审批入口', 'backend', <ApiOutlined />, ['backend/internal/modules/collaboration/handler.go'], ['CreateApprovalInstance()', 'ActionApproval()', 'RunWorkflow()'], '创建审批实例、记录动作、推动流程状态。', ['审批 500 优先看这里。'])),
      node('runtime', 780, 300, brief('runtime engine', '节点运行时', 'backend', <BranchesOutlined />, ['backend/internal/modules/collaboration/workflow_runtime.go', 'backend/internal/modules/collaboration/approval_runtime_store.go'], ['buildApprovalStartPlan()', 'actionRuntimeApproval()'], '计算当前节点、下一节点、审批动作和状态推进。', ['流程卡住看 approval_instance_nodes。'])),
      node('business-map', 520, 300, brief('业务状态映射', 'workflow bindings', 'backend', <UserSwitchOutlined />, ['backend/internal/modules/collaboration/workflow_business.go', 'backend/internal/modules/collaboration/workflow_business_store.go'], ['ApplyBusinessStatus()', 'SaveWorkflowBinding()'], '把流程状态同步到业务对象状态。', ['业务状态不变看 adapter_code。'])),
      node('todo', 260, 300, brief('TodoCenterPage', '待办中心', 'frontend', <TableOutlined />, ['frontend/src/features/collaboration/pages/TodoCenterPage.tsx'], ['listTodos()', 'actionApproval()'], '展示当前用户待办并支持处理。', ['待办缺失看 assignee/角色匹配。'])),
      node('notification', 0, 300, brief('通知中心', '消息提醒', 'async', <BellOutlined />, ['backend/internal/modules/collaboration/handler.go', 'frontend/src/features/collaboration/pages/NotificationCenterPage.tsx'], ['CreateNotification()', 'listNotifications()'], '审批和任务产生通知，前端展示未读提醒。', ['通知不更新看 WebSocket 和 sys_notifications。'])),
      node('workflow-db', 520, 550, brief('流程表', 'workflow_* / approval_*', 'data', <DatabaseOutlined />, ['backend/migrations/000004_collaboration.up.sql', 'backend/migrations/000020_approval_runtime_nodes.up.sql'], ['workflow_definitions', 'approval_instances', 'approval_instance_nodes'], '保存流程定义、实例、节点和审批动作。', ['直接查实例状态定位卡点。'])),
    ],
    edges: [
      edge('workflow-page', 'collab-api', '维护定义'),
      edge('approval-page', 'collab-api', '提交/处理'),
      edge('collab-api', 'collab-handler', '/approval /workflows'),
      edge('collab-handler', 'runtime', '推进节点'),
      edge('runtime', 'business-map', '状态同步'),
      edge('runtime', 'todo', '生成待办'),
      edge('runtime', 'notification', '发送通知'),
      edge('runtime', 'workflow-db', '写入运行态'),
      edge('business-map', 'workflow-db', '绑定/映射'),
    ],
    timeline: [
      ['配置流程', 'WorkflowPage 保存节点和连线。'],
      ['提交审批', 'ApprovalCenterPage 创建审批实例。'],
      ['构造运行态', '后端生成 approval_instance_nodes。'],
      ['处理动作', 'ActionApproval 写入动作并推进节点。'],
      ['同步业务状态', 'workflow_business 根据映射更新业务对象。'],
      ['生成待办通知', '待办中心和通知中心刷新可见。'],
    ],
  },
  {
    key: 'notification',
    label: '通知 WebSocket',
    summary: '展示通知列表、未读数、WebSocket 推送和后端通知写入逻辑，排查红点不更新或通知列表不刷新的问题。',
    tags: ['通知', 'WebSocket', '未读数'],
    nodes: [
      node('layout-badge', 0, 60, brief('Header Badge', '未读红点', 'frontend', <BellOutlined />, ['frontend/src/layouts/BasicLayout.tsx'], ['refreshNotificationSummary()', 'useNotificationWebSocket()'], '顶部通知图标展示未读数和最近通知。', ['红点不变看 WebSocket 消息。'])),
      node('notification-page', 260, 60, brief('NotificationCenterPage', '通知列表', 'frontend', <TableOutlined />, ['frontend/src/features/collaboration/pages/NotificationCenterPage.tsx'], ['listNotifications()', 'markNotificationRead()'], '展示通知列表、标记已读、创建通知。', ['列表不更新看接口分页。'])),
      node('ws-hook', 520, 60, brief('useNotificationWebSocket', '前端连接', 'async', <CloudServerOutlined />, ['frontend/src/hooks/useNotificationWebSocket.ts'], ['connect()', 'onMessage()'], '维护通知 WebSocket 连接和消息分发。', ['断连看 ws URL 和 token。'])),
      node('collab-notif', 780, 60, brief('通知接口', 'notifications', 'backend', <ApiOutlined />, ['backend/internal/modules/collaboration/handler.go'], ['ListNotifications()', 'CreateNotification()', 'MarkNotificationRead()'], '处理通知增删改查和未读计数。', ['未读数错看 read_at。'])),
      node('notif-db', 520, 310, brief('sys_notifications', '通知表', 'data', <DatabaseOutlined />, ['backend/migrations/000004_collaboration.up.sql'], ['INSERT sys_notifications', 'UPDATE read_at'], '保存通知内容、接收人和已读时间。', ['查 recipient_id 是否正确。'])),
      node('producer', 260, 310, brief('业务生产者', '审批 / 定时任务', 'backend', <BranchesOutlined />, ['backend/internal/modules/collaboration/handler.go', 'backend/internal/modules/scheduler/engine.go'], ['INSERT sys_notifications'], '审批、定时任务等模块写入通知。', ['如果表里没数据，查生产者逻辑。'])),
    ],
    edges: [
      edge('layout-badge', 'ws-hook', '订阅'),
      edge('notification-page', 'collab-notif', 'HTTP'),
      edge('ws-hook', 'collab-notif', 'WS'),
      edge('collab-notif', 'notif-db', '读写'),
      edge('producer', 'notif-db', '写入'),
      edge('notif-db', 'layout-badge', '未读数', true),
    ],
    timeline: [
      ['业务写通知', '审批或定时任务写入 sys_notifications。'],
      ['前端订阅', 'BasicLayout 使用 WebSocket 接收变化。'],
      ['刷新未读数', '收到事件后调用 unreadNotificationCount。'],
      ['进入通知中心', 'NotificationCenterPage 分页查询通知。'],
      ['标记已读', '更新 read_at 并刷新 badge。'],
    ],
  },
  {
    key: 'ai',
    label: 'AI 助手',
    summary: '展示浮动 AI、协同 AI 页面、历史消息、流式输出配置和后端代理链路。',
    tags: ['AI', '流式', '历史记录'],
    nodes: [
      node('float-ai', 0, 50, brief('FloatingAIAssistant', '浮动入口', 'frontend', <RobotOutlined />, ['frontend/src/components/FloatingAIAssistant.tsx'], ['sendMessage()', 'historyItems'], '全局浮动 AI 对话入口。', ['按钮不显示看 BasicLayout 是否渲染。'])),
      node('ai-page', 260, 50, brief('AIAssistantPage', 'AI 页面', 'frontend', <RobotOutlined />, ['frontend/src/features/collaboration/pages/AIAssistantPage.tsx'], ['useAIChat()'], '完整 AI 助手页面和会话 UI。', ['页面异常看 hooks/useAIChat。'])),
      node('ai-api', 520, 50, brief('assistant API', 'api/assistant.ts', 'http', <ApiOutlined />, ['frontend/src/api/assistant.ts', 'frontend/src/api/chat.ts'], ['sendAssistantMessage()', 'listAssistantMessages()'], '封装 AI 发送和历史查询。', ['请求字段看这里。'])),
      node('ai-handler', 780, 50, brief('AI handler', '后端代理', 'backend', <CloudServerOutlined />, ['backend/internal/modules/collaboration/ai_assistant_handler.go', 'backend/internal/modules/collaboration/ai_handler.go'], ['Chat()', 'History()'], '保存用户消息、调用外部 AI 或流式服务、返回结果。', ['返回慢看外部 AI endpoint。'])),
      node('ai-config', 780, 310, brief('AIConfig', 'endpoint / model', 'backend', <CodeOutlined />, ['backend/internal/config/config.go', 'backend/.env.example'], ['AIAssistantEndpoint', 'AIStreamModel'], '读取 AI 服务地址、key 和模型配置。', ['配置缺失会影响回复。'])),
      node('ai-db', 520, 310, brief('AI 历史', 'ai_* tables', 'data', <DatabaseOutlined />, ['backend/migrations/*.sql'], ['ai_assistant_messages', 'ai_chat_history'], '保存用户和助手消息历史。', ['历史为空看 insert 是否成功。'])),
    ],
    edges: [
      edge('float-ai', 'ai-api', '发送'),
      edge('ai-page', 'ai-api', '发送/历史'),
      edge('ai-api', 'ai-handler', 'HTTP/stream'),
      edge('ai-handler', 'ai-config', '读取配置'),
      edge('ai-handler', 'ai-db', '保存历史'),
      edge('ai-db', 'ai-page', '历史回显', true),
    ],
    timeline: [
      ['用户发送消息', '浮动入口或 AI 页面触发 api。'],
      ['后端保存用户消息', '写入 ai_assistant_messages 或 ai_chat_history。'],
      ['调用 AI 服务', '按 env 配置请求外部 endpoint。'],
      ['返回结果', '前端更新消息列表或流式追加。'],
      ['查询历史', '再次打开页面时读取历史记录。'],
    ],
  },
  {
    key: 'scheduler',
    label: '定时任务',
    summary: '展示任务配置、手动运行、后台 engine、执行记录和通知写入链路。',
    tags: ['任务', '执行记录', '通知'],
    nodes: [
      node('scheduler-page', 0, 60, brief('SchedulerPage', '任务管理', 'frontend', <ScheduleOutlined />, ['frontend/src/features/scheduler/pages/SchedulerPage.tsx'], ['refreshTaskTable()', 'runTask()', 'toggleTask()'], '管理任务列表、启停任务和手动执行。', ['按钮无效看 scheduler:* 权限。'])),
      node('scheduler-api', 260, 60, brief('scheduler API', 'api/scheduler.ts', 'http', <ApiOutlined />, ['frontend/src/api/scheduler.ts'], ['listTasks()', 'runTaskNow()', 'toggleTask()'], '封装任务管理接口。', ['接口路径从这里核对。'])),
      node('scheduler-handler', 520, 60, brief('scheduler handler', '任务接口', 'backend', <ApiOutlined />, ['backend/internal/modules/scheduler/handler.go'], ['ListTasks()', 'RunTask()', 'ToggleTask()'], '处理任务 CRUD、启停和手动执行请求。', ['执行失败看 handler 返回错误。'])),
      node('engine', 780, 60, brief('Scheduler Engine', '后台执行', 'async', <ScheduleOutlined />, ['backend/internal/modules/scheduler/engine.go'], ['Start()', 'executeTask()', 'RunTaskNow()'], '周期扫描和执行任务，写入执行记录。', ['任务未跑看 engine 是否启动。'])),
      node('task-db', 520, 310, brief('任务表', 'sys_scheduled_tasks', 'data', <DatabaseOutlined />, ['backend/migrations/000007_scheduler_kb.up.sql', 'backend/migrations/000019_scheduler_demo.up.sql'], ['sys_scheduled_tasks', 'sys_task_executions'], '保存任务定义、下次执行时间和执行记录。', ['查 enabled / next_run_at。'])),
      node('task-notif', 260, 310, brief('执行通知', 'sys_notifications', 'async', <BellOutlined />, ['backend/internal/modules/scheduler/engine.go'], ['INSERT sys_notifications'], '任务执行后可写通知供后台红点展示。', ['执行成功但无通知看 engine 通知逻辑。'])),
    ],
    edges: [
      edge('scheduler-page', 'scheduler-api', '操作'),
      edge('scheduler-api', 'scheduler-handler', 'HTTP'),
      edge('scheduler-handler', 'engine', '手动执行'),
      edge('engine', 'task-db', '写执行记录'),
      edge('scheduler-handler', 'task-db', 'CRUD'),
      edge('engine', 'task-notif', '结果通知'),
    ],
    timeline: [
      ['配置任务', 'SchedulerPage 创建或编辑任务。'],
      ['启停任务', 'handler 更新 enabled 和 next_run_at。'],
      ['执行任务', 'engine 周期扫描或手动 RunTaskNow。'],
      ['记录结果', '写入 sys_task_executions。'],
      ['发送通知', '可写入 sys_notifications。'],
    ],
  },
];

const TROUBLESHOOTING_MATRIX = [
  { key: 'menu', symptom: '菜单不显示', first: 'GET /auth/me 的 menus', next: 'sys_menus / sys_role_menus', files: 'auth/handler.go, BasicLayout.tsx, database.go' },
  { key: 'forbidden', symptom: '接口 401 / 403', first: 'Network 请求头和状态码', next: 'PermissionForRequest + 角色菜单授权', files: 'http.ts, auth.go, route_permissions.go' },
  { key: 'blank', symptom: '页面白屏 / 404', first: 'enterpriseRoutes 和菜单 path', next: 'lazy import 具名导出', files: 'AppRouter.tsx, lazyRoutes.ts' },
  { key: 'approval', symptom: '审批卡住 / 待办不出现', first: 'approval_instance_nodes', next: 'assignee / workflow_snapshot', files: 'collaboration/handler.go, workflow_runtime.go' },
  { key: 'notify', symptom: '通知红点不刷新', first: 'WebSocket 连接', next: 'sys_notifications.read_at', files: 'useNotificationWebSocket.ts, BasicLayout.tsx, collaboration/handler.go' },
  { key: 'ai', symptom: 'AI 无回复或历史为空', first: 'AI env 配置和请求日志', next: 'ai_assistant_messages / ai_chat_history', files: 'ai_assistant_handler.go, ai_handler.go, config.go' },
];

const FLOW_INSIGHTS: Record<string, FlowInsight> = {
  overview: {
    focus: ['先定位问题层级', '确认请求是否进入后端', '区分菜单/路由/接口问题'],
    apis: ['/api/v1/*', 'GET /api/v1/auth/me'],
    data: ['sys_menus', 'sys_role_menus', '业务表'],
    checks: ['浏览器 Network', '后端路由注册', '权限码映射'],
  },
  login: {
    focus: ['登录态保存', '当前角色选择', '菜单树构造'],
    apis: ['POST /api/v1/auth/login', 'GET /api/v1/auth/me'],
    data: ['sys_users', 'sys_user_roles', 'sys_role_menus', 'sys_menus'],
    checks: ['accessToken', 'X-Active-Role', 'menus / permissions 返回值'],
  },
  permission: {
    focus: ['401 与 403 分层', '前端按钮权限', '后端强校验'],
    apis: ['任意受保护 /api/v1 请求'],
    data: ['sys_role_menus', 'sys_menus.code'],
    checks: ['PermissionForRequest()', 'RequirePermission()', '角色绑定菜单'],
  },
  crud: {
    focus: ['列表查询', '表单提交', '数据范围过滤', '导出下载'],
    apis: ['GET /customers', 'POST /customers', 'PUT /customers/:id', 'DELETE /customers/:id'],
    data: ['biz_customers', 'sys_role_menus.data_scope'],
    checks: ['ProTable request', 'api/*.ts 参数', 'handler SQL Scan'],
  },
  workflow: {
    focus: ['流程定义', '审批实例', '运行节点', '业务状态同步'],
    apis: ['/workflows', '/approval/instances', '/approval/instances/:id/action'],
    data: ['workflow_definitions', 'approval_instances', 'approval_instance_nodes', 'approval_actions'],
    checks: ['workflow_snapshot', 'assignee 匹配', 'business_status 映射'],
  },
  notification: {
    focus: ['未读红点', '通知列表', 'WebSocket 推送'],
    apis: ['/notifications', '/notifications/unread-count', 'ws notification channel'],
    data: ['sys_notifications.read_at', 'recipient_id'],
    checks: ['WebSocket 是否连接', 'unread count 是否刷新', '通知生产者是否写表'],
  },
  ai: {
    focus: ['AI 配置', '消息发送', '历史保存', '流式返回'],
    apis: ['/ai-assistant/chat', '/ai-assistant/messages', '/ai/history'],
    data: ['ai_assistant_messages', 'ai_chat_history'],
    checks: ['AI endpoint/env', '请求超时', '历史 insert'],
  },
  scheduler: {
    focus: ['任务启停', '手动执行', '执行记录', '执行通知'],
    apis: ['/scheduler/tasks', '/scheduler/tasks/:id/run', '/scheduler/tasks/:id/toggle'],
    data: ['sys_scheduled_tasks', 'sys_task_executions', 'sys_notifications'],
    checks: ['engine 是否启动', 'enabled / next_run_at', '执行输出'],
  },
};

const IMPORTANT_FILES = [
  {
    key: 'frontend',
    label: '前端入口与路由',
    children: ['frontend/src/main.tsx', 'frontend/src/routes/AppRouter.tsx', 'frontend/src/routes/lazyRoutes.ts', 'frontend/src/layouts/BasicLayout.tsx'],
  },
  {
    key: 'request',
    label: '前端请求与状态',
    children: ['frontend/src/request/http.ts', 'frontend/src/store/authStore.ts', 'frontend/src/components/Permission.tsx', 'frontend/src/api/*.ts'],
  },
  {
    key: 'backend',
    label: '后端服务与权限',
    children: ['backend/internal/http/server.go', 'backend/internal/http/middleware/auth.go', 'backend/internal/http/middleware/route_permissions.go', 'backend/internal/http/middleware/audit.go'],
  },
  {
    key: 'modules',
    label: '重要功能模块',
    children: ['backend/internal/modules/auth/handler.go', 'backend/internal/modules/customer/handler.go', 'backend/internal/modules/collaboration/handler.go', 'backend/internal/modules/scheduler/engine.go'],
  },
  {
    key: 'data',
    label: '数据与菜单',
    children: ['backend/internal/database/database.go', 'backend/migrations/*.sql', 'backend/api/openapi.yaml'],
  },
];

const nodeTypes = { architectureNode: memo(ArchitectureNode) };

export function ArchitecturePage() {
  const [activeFlowKey, setActiveFlowKey] = useState(FLOW_DEFINITIONS[0].key);
  const activeFlow = useMemo(() => FLOW_DEFINITIONS.find((item) => item.key === activeFlowKey) ?? FLOW_DEFINITIONS[0], [activeFlowKey]);
  const [nodes, setNodes, onNodesChange] = useNodesState<ArchitectureFlowNode>(activeFlow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ArchitectureFlowEdge>(activeFlow.edges);
  const [activeNodeId, setActiveNodeId] = useState(activeFlow.nodes[0].id);

  useEffect(() => {
    setNodes(activeFlow.nodes);
    setEdges(activeFlow.edges);
    setActiveNodeId(activeFlow.nodes[0].id);
  }, [activeFlow, setEdges, setNodes]);

  const activeNode = useMemo(() => nodes.find((item) => item.id === activeNodeId) ?? nodes[0] ?? activeFlow.nodes[0], [activeFlow.nodes, activeNodeId, nodes]);
  const upstream = useMemo(() => activeFlow.edges.filter((item) => item.target === activeNode?.id).map((item) => activeFlow.nodes.find((nodeItem) => nodeItem.id === item.source)?.data.title ?? item.source), [activeFlow, activeNode?.id]);
  const downstream = useMemo(() => activeFlow.edges.filter((item) => item.source === activeNode?.id).map((item) => activeFlow.nodes.find((nodeItem) => nodeItem.id === item.target)?.data.title ?? item.target), [activeFlow, activeNode?.id]);
  const activeInsight = FLOW_INSIGHTS[activeFlow.key];

  return (
    <div className="architecture-page">
      <Card className="architecture-flow-selector">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Segmented
            block
            value={activeFlowKey}
            options={FLOW_DEFINITIONS.map((flow) => ({ label: flow.label, value: flow.key }))}
            onChange={(value) => setActiveFlowKey(String(value))}
          />
          <Row gutter={[12, 12]} className="architecture-insight-grid">
            <Col xs={24} md={6}>
              <InsightBlock title="关注点" items={activeInsight.focus} color="blue" />
            </Col>
            <Col xs={24} md={6}>
              <InsightBlock title="关键接口" items={activeInsight.apis} color="gold" />
            </Col>
            <Col xs={24} md={6}>
              <InsightBlock title="关键数据" items={activeInsight.data} color="red" />
            </Col>
            <Col xs={24} md={6}>
              <InsightBlock title="排查入口" items={activeInsight.checks} color="green" />
            </Col>
          </Row>
        </Space>
      </Card>

      <div className="architecture-workspace architecture-workspace-rich">
        <div className="architecture-flow">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, nodeItem) => setActiveNodeId(nodeItem.id)}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.1} />
            <Controls />
            <MiniMap pannable zoomable nodeColor={(nodeItem) => LAYER_META[(nodeItem.data?.layer as ArchitectureLayer) ?? 'frontend'].color} />
            <Panel position="top-left" className="architecture-flow-panel">
              <Space size={6} wrap>
                <Tag color="blue">{activeFlow.label}</Tag>
                {activeFlow.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
              </Space>
            </Panel>
          </ReactFlow>
        </div>

        <Card className="architecture-detail" title={activeNode?.data.title}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Tag color={LAYER_META[activeNode.data.layer].color}>{LAYER_META[activeNode.data.layer].label}</Tag>
            <Paragraph>{activeNode.data.purpose}</Paragraph>
            <div>
              <Text strong>上游</Text>
              <div className="architecture-code-list">
                {(upstream.length ? upstream : ['无']).map((item) => <Tag key={item}>{item}</Tag>)}
              </div>
            </div>
            <div>
              <Text strong>下游</Text>
              <div className="architecture-code-list">
                {(downstream.length ? downstream : ['无']).map((item) => <Tag key={item}>{item}</Tag>)}
              </div>
            </div>
            <div>
              <Text strong>主要文件</Text>
              <div className="architecture-code-list">
                {activeNode.data.files.map((file) => <Text code key={file}>{file}</Text>)}
              </div>
            </div>
            <div>
              <Text strong>关键方法</Text>
              <div className="architecture-code-list">
                {activeNode.data.methods.map((method) => <Text code key={method}>{method}</Text>)}
              </div>
            </div>
            <div>
              <Text strong>排查建议</Text>
              <ul className="architecture-checklist">
                {activeNode.data.troubleshooting.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </Space>
        </Card>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card className="architecture-docs" title={`${activeFlow.label}调用顺序`}>
            <Paragraph type="secondary">{activeFlow.summary}</Paragraph>
            <Timeline
              items={activeFlow.timeline.map(([title, description]) => ({
                color: 'blue',
                children: (
                  <Space direction="vertical" size={2}>
                    <Text strong>{title}</Text>
                    <Text type="secondary">{description}</Text>
                  </Space>
                ),
              }))}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card className="architecture-docs" title="排查矩阵">
            <Table
              size="small"
              rowKey="key"
              pagination={false}
              dataSource={TROUBLESHOOTING_MATRIX}
              columns={[
                { title: '现象', dataIndex: 'symptom', width: 120 },
                { title: '先查', dataIndex: 'first' },
                { title: '再查', dataIndex: 'next' },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card className="architecture-docs" title="关键文件索引">
        <Tabs
          items={[
            {
              key: 'files',
              label: '文件',
              children: (
                <Collapse
                  items={IMPORTANT_FILES.map((group) => ({
                    key: group.key,
                    label: group.label,
                    children: (
                      <div className="architecture-code-list">
                        {group.children.map((file) => <Text code key={file}>{file}</Text>)}
                      </div>
                    ),
                  }))}
                />
              ),
            },
            {
              key: 'matrix',
              label: '现象定位',
              children: (
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={TROUBLESHOOTING_MATRIX}
                  columns={[
                    { title: '现象', dataIndex: 'symptom', width: 140 },
                    { title: '相关文件', dataIndex: 'files' },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

function InsightBlock({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="architecture-insight-block">
      <Text strong>{title}</Text>
      <div className="architecture-insight-tags">
        {items.map((item) => <Tag color={color} key={item}>{item}</Tag>)}
      </div>
    </div>
  );
}

function ArchitectureNode({ data, selected }: NodeProps<ArchitectureFlowNode>) {
  const meta = LAYER_META[data.layer];
  return (
    <div className={`architecture-node${selected ? ' architecture-node-selected' : ''}`} style={{ borderColor: meta.color, background: meta.bg }}>
      <Handle type="target" position={Position.Left} className="architecture-handle architecture-handle-target" />
      <div className="architecture-node-icon" style={{ color: meta.color }}>
        {data.icon}
      </div>
      <div className="architecture-node-main">
        <Text strong ellipsis>{data.title}</Text>
        <Text type="secondary" className="architecture-node-subtitle">{data.subtitle}</Text>
      </div>
      <Handle type="source" position={Position.Right} className="architecture-handle architecture-handle-source" />
    </div>
  );
}

function brief(
  title: string,
  subtitle: string,
  layer: ArchitectureLayer,
  icon: ReactNode,
  files: string[],
  methods: string[],
  purpose: string,
  troubleshooting: string[],
): ArchitectureNodeData {
  return { title, subtitle, layer, icon, files, methods, purpose, troubleshooting };
}

function node(id: string, x: number, y: number, data: ArchitectureNodeData): ArchitectureFlowNode {
  return {
    id,
    type: 'architectureNode',
    position: { x, y },
    data,
  };
}

function edge(source: string, target: string, label: string, animated = false): ArchitectureFlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    animated,
    label,
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
    labelBgStyle: { fill: '#fff', fillOpacity: 0.92 },
    style: { strokeWidth: 2 },
  };
}
