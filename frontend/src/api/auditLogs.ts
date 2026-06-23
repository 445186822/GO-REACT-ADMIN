import { http } from '../request/http';
import type { Page } from './users';

export type AuditLogRow = {
  id: number;
  request_id: string;
  user_id?: number | null;
  username?: string | null;
  action: string;
  resource: string;
  resource_id?: string | null;
  method: string;
  path: string;
  ip?: string | null;
  user_agent?: string | null;
  response_code: number;
  success: boolean;
  error_message?: string | null;
  created_at: string;
};

export async function listAuditLogs(params: {
  username?: string;
  resource?: string;
  page?: number;
  page_size?: number;
}): Promise<Page<AuditLogRow>> {
  const res = await http.get<unknown, { data: Page<AuditLogRow> }>('/audit-logs', { params });
  return res.data;
}
