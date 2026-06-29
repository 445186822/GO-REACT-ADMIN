import { http } from '../request/http';

export type UserRow = {
  id: number;
  username: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'DISABLED';
  department?: string | null;
  role_id?: number | null;
  role_name?: string | null;
};

export type Page<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export async function listUsers(params: { keyword?: string; page?: number; page_size?: number }): Promise<Page<UserRow>> {
  const res = await http.get<unknown, { data: Page<UserRow> }>('/users', { params });
  return res.data;
}

export type UserForm = {
  username?: string;
  password?: string;
  display_name: string;
  email?: string;
  phone?: string;
  status?: 'ACTIVE' | 'DISABLED';
  role_id?: number;
};

export async function resetUserPassword(id: number, password: string): Promise<void> {
  await http.put(`/users/${id}/reset-password`, { password });
}

export async function createUser(payload: UserForm): Promise<{ id: number }> {
  const res = await http.post<unknown, { data: { id: number } }>('/users', payload);
  return res.data;
}

export async function updateUser(id: number, payload: UserForm): Promise<{ updated: boolean }> {
  const res = await http.put<unknown, { data: { updated: boolean } }>(`/users/${id}`, payload);
  return res.data;
}

export async function deleteUser(id: number): Promise<{ deleted: boolean }> {
  const res = await http.delete<unknown, { data: { deleted: boolean } }>(`/users/${id}`);
  return res.data;
}
