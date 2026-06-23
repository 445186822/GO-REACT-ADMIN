# Enterprise Demo Docs

这些文档用于启动一个可复制到企业项目的全栈模板，而不是只做一次性 demo。

## 阅读顺序

1. `project_plan.md`
   - 总体定位、技术栈、参考来源、阶段规划。

2. `final_stack_overview.txt`
   - 最终全栈组合中每个技术点的作用说明。

3. `development_tasks.md`
   - 实际开发任务清单。
   - 后续编码应按 Phase 0 到 Phase 13 推进。

4. `database_design.md`
   - PostgreSQL 表设计。
   - SQLC 查询规范。
   - 软删除、数据权限、主子表、审计日志设计。

5. `api_design.md`
   - REST API 规划。
   - 统一响应、错误码、权限码、WebSocket、SSE 接口。

6. `frontend_pages.md`
   - React + Ant Design 页面规划。
   - 每个页面对应的企业级能力。

## 当前项目参考

已参考当前目录里的项目：

- `PrescriptionSystem`
  - RBAC、data_scope、统一响应、WebSocket、软删除、审计。

- `SmartMedicationGuidance`
  - 动态菜单、双端 WebSocket、统一响应、前端权限状态。

- `dbz`
  - SSE AI 流式输出、AI assistant、审计日志、系统配置、后台模块覆盖。

## 建议下一步

优先执行：

1. 创建新项目目录 `enterprise-demo`。
2. 初始化 `backend` 和 `frontend`。
3. 按 `development_tasks.md` 的 Phase 0 到 Phase 5 先跑通：
   - Docker Compose
   - Echo 后端骨架
   - SQLC + migrate
   - JWT 登录
   - React + Ant Design Layout
   - 用户管理 CRUD

第一阶段不要先做 AI、审批、WebSocket。先把企业后台骨架跑通，再扩展差异化能力。
