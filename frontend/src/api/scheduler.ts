import { http } from '../request/http';
import type { Page } from './users';

export type TaskRow = {
  id: number;
  name: string;
  cron_expr: string;
  task_type: string;
  config?: string | null;
  enabled: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
  remark?: string | null;
  created_at: string;
};

export type TaskForm = {
  name: string;
  cron_expr?: string;
  task_type?: string;
  config?: string;
  remark?: string;
};

export type ExecutionRow = {
  id: number;
  task_id: number;
  status: string;
  started_at: string;
  finished_at?: string | null;
  output?: string | null;
  error_message?: string | null;
};

export type RunTaskResult = {
  execution_id: number;
  status: string;
  output?: string | null;
  error_message?: string | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
};

export async function listTasks(params: { keyword?: string; page?: number; page_size?: number }): Promise<Page<TaskRow>> {
  const res = await http.get<unknown, { data: Page<TaskRow> }>('/scheduler/tasks', { params });
  return res.data;
}

export async function createTask(payload: TaskForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/scheduler/tasks', payload);
  return res.data;
}

export async function updateTask(id: number, payload: TaskForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/scheduler/tasks/${id}`, payload);
  return res.data;
}

export async function deleteTask(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/scheduler/tasks/${id}`);
  return res.data;
}

export async function toggleTask(id: number): Promise<{ enabled: boolean }> {
  const res = await http.post<unknown, { data: { enabled: boolean } }>(`/scheduler/tasks/${id}/toggle`);
  return res.data;
}

export async function runTask(id: number): Promise<RunTaskResult> {
  const res = await http.post<unknown, { data: RunTaskResult }>(`/scheduler/tasks/${id}/run`);
  return res.data;
}

export async function listExecutions(taskId: number, params: { page?: number; page_size?: number }): Promise<Page<ExecutionRow>> {
  const res = await http.get<unknown, { data: Page<ExecutionRow> }>(`/scheduler/tasks/${taskId}/executions`, { params });
  return res.data;
}
