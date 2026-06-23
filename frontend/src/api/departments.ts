import { http } from '../request/http';

export type DepartmentRow = {
  id: number;
  parent_id?: number | null;
  code: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
};

export async function listDepartments(): Promise<DepartmentRow[]> {
  const res = await http.get<unknown, { data: DepartmentRow[] }>('/departments');
  return res.data;
}
