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
