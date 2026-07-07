import { describe, expect, it } from 'vitest';
import { buildMenuTree, menuParentOptions } from './menuView';
import type { MenuRow } from '../../api/menus';

describe('menu view helpers', () => {
  it('builds a tree from flat menu rows', () => {
    const rows: MenuRow[] = [
      { id: 3, parent_id: 1, type: 'page', code: 'role:view', name: '角色管理', path: '/system/roles', component: 'RoleListPage', icon: 'TeamOutlined', sort_order: 3 },
      { id: 1, parent_id: null, type: 'directory', code: 'system', name: '系统管理', path: null, component: null, icon: 'SettingOutlined', sort_order: 1 },
      { id: 2, parent_id: 1, type: 'page', code: 'user:view', name: '用户管理', path: '/system/users', component: 'UserListPage', icon: 'UserOutlined', sort_order: 2 },
      { id: 4, parent_id: 2, type: 'button', code: 'user:create', name: '创建用户', path: null, component: null, icon: null, sort_order: 3 },
    ];

    const tree = buildMenuTree(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('系统管理');
    expect(tree[0].children?.[0].name).toBe('用户管理');
    expect(tree[0].children?.[0].children?.[0].code).toBe('user:create');
    expect(tree[0].children?.map((item) => item.name)).toEqual(['用户管理', '角色管理']);
  });

  it('creates parent select options and excludes the edited menu', () => {
    const rows: MenuRow[] = [
      { id: 1, parent_id: null, type: 'directory', code: 'system', name: '系统管理', path: null, component: null, icon: null, sort_order: 1 },
      { id: 2, parent_id: 1, type: 'page', code: 'menu:view', name: '菜单管理', path: '/system/menus', component: 'MenuListPage', icon: null, sort_order: 2 },
      { id: 3, parent_id: 2, type: 'page', code: 'menu:child', name: '子页面', path: '/system/menus/child', component: 'MenuChildPage', icon: null, sort_order: 3 },
    ];

    const options = menuParentOptions(rows, 2);

    expect(options).toEqual([{ label: '系统管理 (目录)', value: 1 }]);
  });
});
