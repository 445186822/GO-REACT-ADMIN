import type { ComponentType } from 'react';

type LazyModule = {
  default: ComponentType;
};

export type EnterpriseRoute = {
  path: string;
  permission: string;
  loader: () => Promise<LazyModule>;
};

/** Create a lazy loader that extracts a named export as the default export for React.lazy. */
function page(importFn: () => Promise<unknown>, exportName: string): () => Promise<LazyModule> {
  return () => importFn().then((m) => ({ default: (m as Record<string, ComponentType>)[exportName] }));
}

export const enterpriseRoutes: EnterpriseRoute[] = [
  { path: 'dashboard',                   permission: 'dashboard',            loader: page(() => import('../features/dashboard/pages/DashboardPage'), 'DashboardPage') },
  { path: 'system/users',               permission: 'user:view',            loader: page(() => import('../features/user/pages/UserListPage'), 'UserListPage') },
  { path: 'system/roles',               permission: 'role:view',            loader: page(() => import('../features/role/pages/RoleListPage'), 'RoleListPage') },
  { path: 'system/menus',               permission: 'menu:view',            loader: page(() => import('../features/menu/pages/MenuListPage'), 'MenuListPage') },
  { path: 'system/departments',         permission: 'department:view',      loader: page(() => import('../features/department/pages/DepartmentListPage'), 'DepartmentListPage') },
  { path: 'business/customers',         permission: 'customer:view',        loader: page(() => import('../features/customer/pages/CustomerListPage'), 'CustomerListPage') },
  { path: 'business/complex-forms',     permission: 'complex-form:view',    loader: page(() => import('../features/complexform/pages/ComplexFormPage'), 'ComplexFormPage') },
  { path: 'collaboration/todos',         permission: 'todo:view',            loader: page(() => import('../features/collaboration/pages/TodoCenterPage'), 'TodoCenterPage') },
  { path: 'collaboration/notifications', permission: 'notification:view',   loader: page(() => import('../features/collaboration/pages/NotificationCenterPage'), 'NotificationCenterPage') },
  { path: 'collaboration/chat',          permission: 'chat:view',            loader: page(() => import('../features/chat/pages/ChatPage'), 'ChatPage') },
  { path: 'collaboration/message-templates', permission: 'message-template:view', loader: page(() => import('../features/collaboration/pages/MessageTemplatePage'), 'MessageTemplatePage') },
  { path: 'collaboration/approvals',     permission: 'approval:view',        loader: page(() => import('../features/collaboration/pages/ApprovalCenterPage'), 'ApprovalCenterPage') },
  { path: 'collaboration/workflows',     permission: 'workflow:view',        loader: page(() => import('../features/collaboration/pages/WorkflowPage'), 'WorkflowPage') },
  { path: 'collaboration/ai-assistant',  permission: 'ai:chat',              loader: page(() => import('../features/collaboration/pages/AIAssistantPage'), 'AIAssistantPage') },
  { path: 'files',                       permission: 'file:view',            loader: page(() => import('../features/file/pages/FileCenterPage'), 'FileCenterPage') },
  { path: 'logs/operation',             permission: 'audit:view',            loader: page(() => import('../features/auditlog/pages/AuditLogPage'), 'AuditLogPage') },
  { path: 'settings',                    permission: 'settings:view',        loader: page(() => import('../features/settings/pages/SettingsPage'), 'SettingsPage') },
  { path: 'system/data-dict',           permission: 'datadict:view',        loader: page(() => import('../features/datadict/pages/DataDictPage'), 'DataDictPage') },
  { path: 'system/recycle-bin',         permission: 'recycle:view',         loader: page(() => import('../features/recyclebin/pages/RecycleBinPage'), 'RecycleBinPage') },
  { path: 'system/monitor',             permission: 'monitor:view',         loader: page(() => import('../features/monitor/pages/SystemMonitorPage'), 'SystemMonitorPage') },
  { path: 'system/scheduler',           permission: 'scheduler:view',       loader: page(() => import('../features/scheduler/pages/SchedulerPage'), 'SchedulerPage') },
  { path: 'system/architecture',        permission: 'architecture:view',    loader: page(() => import('../features/architecture/pages/ArchitecturePage'), 'ArchitecturePage') },
  { path: 'system/queue-lab/kafka',     permission: 'queue:kafka',          loader: page(() => import('../features/queuelab/pages/KafkaLabPage'), 'KafkaLabPage') },
  { path: 'system/queue-lab/rabbitmq',  permission: 'queue:rabbitmq',       loader: page(() => import('../features/queuelab/pages/RabbitMQLabPage'), 'RabbitMQLabPage') },
  { path: 'system/queue-lab/tcp',       permission: 'queue:tcp',            loader: page(() => import('../features/queuelab/pages/IoTProtocolLabPage'), 'TCPLabPage') },
  { path: 'system/queue-lab/udp',       permission: 'queue:udp',            loader: page(() => import('../features/queuelab/pages/IoTProtocolLabPage'), 'UDPLabPage') },
  { path: 'system/queue-lab/mqtt',      permission: 'queue:mqtt',           loader: page(() => import('../features/queuelab/pages/IoTProtocolLabPage'), 'MQTTLabPage') },
  { path: 'knowledge-base',             permission: 'kb:view',              loader: page(() => import('../features/knowledgebase/pages/KnowledgeBasePage'), 'KnowledgeBasePage') },
];
