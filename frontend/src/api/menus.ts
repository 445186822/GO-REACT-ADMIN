import { http } from '../request/http';

export type MenuRow = {
  id: number;
  parent_id?: number | null;
  type: 'directory' | 'page' | 'button';
  code: string;
  name: string;
  path?: string | null;
  component?: string | null;
  icon?: string | null;
  sort_order: number;
};

export type MenuForm = {
  parent_id?: number | null;
  type: MenuRow['type'];
  code: string;
  name: string;
  path?: string | null;
  component?: string | null;
  icon?: string | null;
  sort_order?: number;
};

export async function listMenus(): Promise<MenuRow[]> {
  const res = await http.get<unknown, { data: MenuRow[] }>('/menus');
  return res.data;
}

export async function createMenu(payload: MenuForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/menus', payload);
  return res.data;
}

export async function updateMenu(id: number, payload: MenuForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/menus/${id}`, payload);
  return res.data;
}

export async function deleteMenu(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/menus/${id}`);
  return res.data;
}
