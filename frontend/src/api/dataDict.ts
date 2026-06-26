import { http } from '../request/http';
import type { Page } from './users';

export type DictTypeRow = {
  id: number;
  code: string;
  name: string;
  status: 'ENABLED' | 'DISABLED';
  remark?: string | null;
  sort_order: number;
};

export type DictTypeForm = {
  code: string;
  name: string;
  status?: string;
  remark?: string;
  sort_order?: number;
};

export type DictItemRow = {
  id: number;
  type_id: number;
  label: string;
  value: string;
  status: 'ENABLED' | 'DISABLED';
  remark?: string | null;
  sort_order: number;
};

export type DictItemForm = {
  label: string;
  value: string;
  status?: string;
  remark?: string;
  sort_order?: number;
};

export type DictTypeTreeNode = DictTypeRow & {
  children: DictItemRow[];
};

export type BatchSortItem = {
  id: number;
  sort_order: number;
};

// Types
export async function listDictTypes(params: {
  keyword?: string;
  page?: number;
  page_size?: number;
}): Promise<Page<DictTypeRow>> {
  const res = await http.get<unknown, { data: Page<DictTypeRow> }>('/dict/types', { params });
  return res.data;
}

export async function treeDictTypes(): Promise<DictTypeTreeNode[]> {
  const res = await http.get<unknown, { data: DictTypeTreeNode[] }>('/dict/types/tree');
  return res.data;
}

export async function createDictType(payload: DictTypeForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/dict/types', payload);
  return res.data;
}

export async function updateDictType(id: number, payload: DictTypeForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/dict/types/${id}`, payload);
  return res.data;
}

export async function deleteDictType(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/dict/types/${id}`);
  return res.data;
}

// Items
export async function listDictItems(typeId: number): Promise<DictItemRow[]> {
  const res = await http.get<unknown, { data: DictItemRow[] }>(`/dict/types/${typeId}/items`);
  return res.data;
}

export async function createDictItem(typeId: number, payload: DictItemForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>(`/dict/types/${typeId}/items`, payload);
  return res.data;
}

export async function updateDictItem(id: number, payload: DictItemForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/dict/items/${id}`, payload);
  return res.data;
}

export async function deleteDictItem(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/dict/items/${id}`);
  return res.data;
}

export async function batchSortDictItems(items: BatchSortItem[]): Promise<{ sorted: boolean }> {
  const res = await http.put<unknown, { data: { sorted: boolean } }>('/dict/items/batch-sort', items);
  return res.data;
}
