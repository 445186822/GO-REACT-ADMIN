import type { ComponentType } from 'react';

type LazyModule = {
  default: ComponentType;
};

export type EnterpriseRoute = {
  path: string;
  permission: string;
  loader: () => Promise<LazyModule>;
};

export const enterpriseRoutes: EnterpriseRoute[] = [
  route('dashboard', 'dashboard', () => import('../features/dashboard/pages/DashboardPage').then(named('DashboardPage'))),
  route('system/users', 'user:view', () => import('../features/user/pages/UserListPage').then(named('UserListPage'))),
  route('system/roles', 'role:view', () => import('../features/role/pages/RoleListPage').then(named('RoleListPage'))),
  route('system/menus', 'menu:view', () => import('../features/menu/pages/MenuListPage').then(named('MenuListPage'))),
  route('system/departments', 'department:view', () => import('../features/department/pages/DepartmentListPage').then(named('DepartmentListPage'))),
  route('business/customers', 'customer:view', () => import('../features/customer/pages/CustomerListPage').then(named('CustomerListPage'))),
  route('collaboration/todos', 'todo:view', () => import('../features/collaboration/pages/TodoCenterPage').then(named('TodoCenterPage'))),
  route('collaboration/notifications', 'notification:view', () => import('../features/collaboration/pages/NotificationCenterPage').then(named('NotificationCenterPage'))),
  route('collaboration/chat', 'chat:view', () => import('../features/chat/pages/ChatPage').then(named('ChatPage'))),
  route('collaboration/message-templates', 'message-template:view', () => import('../features/collaboration/pages/MessageTemplatePage').then(named('MessageTemplatePage'))),
  route('collaboration/approvals', 'approval:view', () => import('../features/collaboration/pages/ApprovalCenterPage').then(named('ApprovalCenterPage'))),
  route('collaboration/workflows', 'workflow:view', () => import('../features/collaboration/pages/WorkflowPage').then(named('WorkflowPage'))),
  route('collaboration/ai-assistant', 'ai:chat', () => import('../features/collaboration/pages/AIAssistantPage').then(named('AIAssistantPage'))),
  route('files', 'file:view', () => import('../features/file/pages/FileCenterPage').then(named('FileCenterPage'))),
  route('logs/operation', 'audit:view', () => import('../features/auditlog/pages/AuditLogPage').then(named('AuditLogPage'))),
  route('settings', 'settings:view', () => import('../features/settings/pages/SettingsPage').then(named('SettingsPage'))),
  route('system/data-dict', 'datadict:view', () => import('../features/datadict/pages/DataDictPage').then(named('DataDictPage'))),
  route('system/recycle-bin', 'recycle:view', () => import('../features/recyclebin/pages/RecycleBinPage').then(named('RecycleBinPage'))),
  route('system/monitor', 'monitor:view', () => import('../features/monitor/pages/SystemMonitorPage').then(named('SystemMonitorPage'))),
  route('system/scheduler', 'scheduler:view', () => import('../features/scheduler/pages/SchedulerPage').then(named('SchedulerPage'))),
  route('system/architecture', 'architecture:view', () => import('../features/architecture/pages/ArchitecturePage').then(named('ArchitecturePage'))),
  route('system/queue-lab/kafka', 'queue:kafka', () => import('../features/queuelab/pages/KafkaLabPage').then(named('KafkaLabPage'))),
  route('system/queue-lab/rabbitmq', 'queue:rabbitmq', () => import('../features/queuelab/pages/RabbitMQLabPage').then(named('RabbitMQLabPage'))),
  route('system/queue-lab/tcp', 'queue:tcp', () => import('../features/queuelab/pages/IoTProtocolLabPage').then(named('TCPLabPage'))),
  route('system/queue-lab/udp', 'queue:udp', () => import('../features/queuelab/pages/IoTProtocolLabPage').then(named('UDPLabPage'))),
  route('system/queue-lab/mqtt', 'queue:mqtt', () => import('../features/queuelab/pages/IoTProtocolLabPage').then(named('MQTTLabPage'))),
  route('knowledge-base', 'kb:view', () => import('../features/knowledgebase/pages/KnowledgeBasePage').then(named('KnowledgeBasePage'))),
];

function route(path: string, permission: string, loader: EnterpriseRoute['loader']): EnterpriseRoute {
  return { path, permission, loader };
}

function named(exportName: string) {
  return (module: unknown) => ({ default: (module as Record<string, ComponentType>)[exportName] });
}
