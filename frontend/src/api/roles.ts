import { http } from '../request/http';

export type RoleRow = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'DISABLED';
};

export async function listRoles(): Promise<RoleRow[]> {
  const res = await http.get<unknown, { data: RoleRow[] }>('/roles');
  return res.data;
}

export async function createRole(data: {
  code: string;
  name: string;
  description?: string;
  status?: string;
}): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/roles', data);
  return res.data;
}

export async function updateRole(
  id: number,
  data: { name?: string; description?: string; status?: string },
) {
  return http.put(`/roles/${id}`, data);
}

export async function deleteRole(id: number) {
  return http.delete(`/roles/${id}`);
}

export async function listRoleMenus(id: number): Promise<number[]> {
  const res = await http.get<unknown, { data: number[] }>(`/roles/${id}/menus`);
  return res.data;
}

export async function updateRoleMenus(id: number, menuIds: number[]) {
  return http.put(`/roles/${id}/menus`, { menu_ids: menuIds });
}
