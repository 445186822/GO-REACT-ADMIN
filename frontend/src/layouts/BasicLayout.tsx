import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  BranchesOutlined,
  CheckSquareOutlined,
  ContactsOutlined,
  ControlOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { type MenuNode, useAuthStore } from '../store/authStore';

const { Header, Sider, Content } = Layout;

const supportedMenuPaths = new Set([
  '/dashboard',
  '/system/users',
  '/system/roles',
  '/system/menus',
  '/system/departments',
  '/business/customers',
  '/files',
  '/logs/operation',
  '/settings',
]);

export function BasicLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);
  const menus = useMemo(() => filterSupportedMenus(user?.menus ?? []), [user?.menus]);
  const activeMenu = useMemo(() => findActiveMenuKeys(menus, normalizePath(location.pathname)), [menus, location.pathname]);

  useEffect(() => {
    if (!collapsed) {
      setOpenKeys(activeMenu.openKeys);
    }
  }, [activeMenu.openKeys, collapsed]);

  return (
    <Layout className="app-shell">
      <Sider trigger={null} collapsible collapsed={collapsed} width={232}>
        <div className="app-logo">{collapsed ? 'ED' : 'Enterprise Demo'}</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={activeMenu.selectedKey ? [activeMenu.selectedKey] : []}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={setOpenKeys}
          onClick={({ key }) => {
            if (String(key).startsWith('/')) {
              navigate(key);
            }
          }}
          items={menus.map(toMenuItem)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }],
              onClick: () => {
                clearSession();
                navigate('/login');
              },
            }}
          >
            <Space className="user-menu">
              <Avatar size="small" icon={<UserOutlined />} />
              <Typography.Text>{user?.display_name ?? user?.username ?? ''}</Typography.Text>
            </Space>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

const iconMap: Record<string, ReactNode> = {
  ApartmentOutlined: <ApartmentOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  AuditOutlined: <AuditOutlined />,
  BellOutlined: <BellOutlined />,
  BranchesOutlined: <BranchesOutlined />,
  CheckSquareOutlined: <CheckSquareOutlined />,
  ContactsOutlined: <ContactsOutlined />,
  ControlOutlined: <ControlOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  FileSearchOutlined: <FileSearchOutlined />,
  FolderOpenOutlined: <FolderOpenOutlined />,
  FolderOutlined: <FolderOutlined />,
  MenuOutlined: <MenuOutlined />,
  MessageOutlined: <MessageOutlined />,
  RobotOutlined: <RobotOutlined />,
  SettingOutlined: <SettingOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  TeamOutlined: <TeamOutlined />,
  UserOutlined: <UserOutlined />,
};

function toMenuItem(menu: MenuNode): any {
  const key = menu.path ? normalizePath(menu.path) : menu.code;
  return {
    key,
    icon: menu.icon ? iconMap[menu.icon] : undefined,
    label: menu.name,
    children: menu.children?.length ? menu.children.map(toMenuItem) : undefined,
    disabled: !menu.path && !menu.children?.length,
  };
}

function filterSupportedMenus(menus: MenuNode[]): MenuNode[] {
  const supported: MenuNode[] = [];

  for (const menu of menus) {
    const children = menu.children?.length ? filterSupportedMenus(menu.children) : [];
    const path = menu.path ? normalizePath(menu.path) : '';

    if (path && !supportedMenuPaths.has(path)) {
      continue;
    }
    if (!path && children.length === 0) {
      continue;
    }

    supported.push({ ...menu, children });
  }

  return supported;
}

function findActiveMenuKeys(menus: MenuNode[], pathname: string) {
  let best: { selectedKey: string; openKeys: string[]; score: number } = { selectedKey: '', openKeys: [], score: -1 };

  function visit(items: MenuNode[], parents: string[]) {
    for (const item of items) {
      const key = item.path ? normalizePath(item.path) : item.code;
      const itemPath = item.path ? normalizePath(item.path) : '';
      if (itemPath && (pathname === itemPath || pathname.startsWith(`${itemPath}/`))) {
        const score = itemPath.length;
        if (score > best.score) {
          best = { selectedKey: itemPath, openKeys: parents, score };
        }
      }
      if (item.children?.length) {
        visit(item.children, [...parents, key]);
      }
    }
  }

  visit(menus, []);
  return { selectedKey: best.selectedKey, openKeys: best.openKeys };
}

function normalizePath(path: string) {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}
