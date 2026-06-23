import { http } from '../request/http';

export type MenuRow = {
  id: number;
  parent_id?: number | null;
  type: 'directory' | 'page' | 'button';
  code: string;
  name: string;
  path?: string | null;
  icon?: string | null;
};

export async function listMenus(): Promise<MenuRow[]> {
  const res = await http.get<unknown, { data: MenuRow[] }>('/menus');
  return res.data;
}
