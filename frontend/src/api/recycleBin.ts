import { http } from '../request/http';
import type { Page } from './users';

export type RecycledRow = {
  id: number;
  source_table: string;
  source_id: number;
  summary: string;
  deleted_by: string;
  deleted_at: string;
};

export async function listRecycled(params: {
  source_table?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}): Promise<Page<RecycledRow>> {
  const res = await http.get<unknown, { data: Page<RecycledRow> }>('/recycle-bin', { params });
  return res.data;
}

export async function restoreRecycled(id: number): Promise<{ restored: boolean }> {
  const res = await http.post<unknown, { data: { restored: boolean } }>(`/recycle-bin/${id}/restore`);
  return res.data;
}

export async function purgeRecycled(id: number): Promise<{ purged: boolean }> {
  const res = await http.delete<unknown, { data: { purged: boolean } }>(`/recycle-bin/${id}`);
  return res.data;
}

export async function purgeAllRecycled(sourceTable?: string): Promise<{ purged: boolean }> {
  const res = await http.delete<unknown, { data: { purged: boolean } }>('/recycle-bin', {
    params: sourceTable ? { source_table: sourceTable } : {},
  });
  return res.data;
}
