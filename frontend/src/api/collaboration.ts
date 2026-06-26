import { http } from '../request/http';

export type PageResult<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type NotificationRow = {
  id: number;
  title: string;
  content: string;
  notif_type: string;
  source_module: string;
  recipient_id?: number | null;
  read_at?: string | null;
  created_at: string;
};

export async function listNotifications(params?: { page?: number; page_size?: number; scope?: string }) {
  const res = await http.get<unknown, { data: PageResult<NotificationRow> }>('/notifications', { params });
  return res.data;
}

export async function createNotification(data: Partial<NotificationRow>) {
  return http.post('/notifications', data);
}

export async function unreadNotificationCount() {
  const res = await http.get<unknown, { data: { count: number } }>('/notifications/unread-count');
  return res.data.count;
}

export async function markNotificationRead(id: number) {
  return http.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  return http.put('/notifications/read-all');
}

export type MessageTemplateRow = {
  id: number;
  code: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  variables: unknown[];
  status: string;
  updated_at: string;
};

export async function listMessageTemplates(params?: { keyword?: string; category?: string; status?: string }) {
  const res = await http.get<unknown, { data: MessageTemplateRow[] }>('/message-templates', { params });
  return res.data;
}

export async function createMessageTemplate(data: Partial<MessageTemplateRow>) {
  return http.post('/message-templates', data);
}

export async function updateMessageTemplate(id: number, data: Partial<MessageTemplateRow>) {
  return http.put(`/message-templates/${id}`, data);
}

export async function deleteMessageTemplate(id: number) {
  return http.delete(`/message-templates/${id}`);
}

export type ApprovalTemplateRow = {
  id: number;
  name: string;
  biz_type: string;
  description?: string | null;
  steps: unknown[];
  workflow_definition_id?: number | null;
  status: string;
  updated_at: string;
};

export type ApprovalInstanceRow = {
  id: number;
  template_id?: number | null;
  title: string;
  biz_type: string;
  biz_id?: string | null;
  applicant: string;
  status: string;
  current_step: number;
  form_data: Record<string, unknown>;
  created_at: string;
};

export async function listApprovalTemplates(params?: { keyword?: string; biz_type?: string; status?: string }) {
  const res = await http.get<unknown, { data: ApprovalTemplateRow[] }>('/approval/templates', { params });
  return res.data;
}

export async function createApprovalTemplate(data: Partial<ApprovalTemplateRow>) {
  return http.post('/approval/templates', data);
}

export async function updateApprovalTemplate(id: number, data: Partial<ApprovalTemplateRow>) {
  return http.put(`/approval/templates/${id}`, data);
}

export async function deleteApprovalTemplate(id: number) {
  return http.delete(`/approval/templates/${id}`);
}

export async function listApprovalInstances(params?: { keyword?: string; biz_type?: string; status?: string }) {
  const res = await http.get<unknown, { data: ApprovalInstanceRow[] }>('/approval/instances', { params });
  return res.data;
}

export async function submitApproval(data: Partial<ApprovalInstanceRow>) {
  return http.post('/approval/instances', data);
}

export async function actionApproval(id: number, data: { action: 'APPROVE' | 'REJECT'; comment?: string }) {
  return http.post(`/approval/instances/${id}/action`, data);
}

export type WorkflowRow = {
  id: number;
  name: string;
  category: string;
  description?: string | null;
  definition: Record<string, unknown>;
  status: string;
  updated_at: string;
};

export type WorkflowInstanceRow = {
  id: number;
  definition_id: number;
  definition_name: string;
  title: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
};

export async function listWorkflows(params?: { keyword?: string; category?: string; status?: string }) {
  const res = await http.get<unknown, { data: WorkflowRow[] }>('/workflows', { params });
  return res.data;
}

export async function createWorkflow(data: Partial<WorkflowRow>) {
  return http.post('/workflows', data);
}

export async function updateWorkflow(id: number, data: Partial<WorkflowRow>) {
  return http.put(`/workflows/${id}`, data);
}

export async function deleteWorkflow(id: number) {
  return http.delete(`/workflows/${id}`);
}

export async function runWorkflow(id: number, data: { title?: string; input?: Record<string, unknown> }) {
  return http.post(`/workflows/${id}/run`, data);
}

export async function listWorkflowInstances() {
  const res = await http.get<unknown, { data: WorkflowInstanceRow[] }>('/workflows/instances');
  return res.data;
}

export type AIMessageRow = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export async function listAIMessages() {
  const res = await http.get<unknown, { data: AIMessageRow[] }>('/ai-assistant/messages');
  return res.data;
}

export async function chatAI(message: string) {
  const res = await http.post<unknown, { data: { reply: string } }>('/ai-assistant/chat', { message });
  return res.data.reply;
}
