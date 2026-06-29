import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  BookOutlined,
  BranchesOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  ContactsOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  ReadOutlined,
  ReloadOutlined,
  RobotOutlined,
  ScheduleOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Breadcrumb, Button, ColorPicker, Divider, Drawer, Dropdown, Layout, Menu, Segmented, Select, Slider, Space, Switch, Tabs, Typography } from 'antd';
import { useEffect, useMemo, useState, type ReactNode, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { unreadNotificationCount } from '../api/collaboration';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FloatingAIAssistant } from '../components/FloatingAIAssistant';
import { useNotificationWebSocket } from '../hooks/useNotificationWebSocket';
import { useAppearanceStore, type ContentPadding, type Density, type HeaderStyle, type LayoutMode, type PageTone, type SidebarTheme, type TabStyle } from '../store/appearanceStore';
import { type MenuNode, useAuthStore } from '../store/authStore';

const { Header, Sider, Content } = Layout;

export function BasicLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const clearSession = useAuthStore((state) => state.clearSession);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const sidebarTheme = useAppearanceStore((state) => state.sidebarTheme);
  const contentPadding = useAppearanceStore((state) => state.contentPadding);
  const tabStyle = useAppearanceStore((state) => state.tabStyle);
  const headerStyle = useAppearanceStore((state) => state.headerStyle);
  const pageTone = useAppearanceStore((state) => state.pageTone);
  const layoutMode = useAppearanceStore((state) => state.layoutMode);
  const showBreadcrumb = useAppearanceStore((state) => state.showBreadcrumb);
  const showPageSearch = useAppearanceStore((state) => state.showPageSearch);
  const menus = useMemo(() => user?.menus ?? [], [user?.menus]);
  const activeMenu = useMemo(() => findActiveMenuKeys(menus, normalizePath(location.pathname)), [menus, location.pathname]);
  const flatMenus = useMemo(() => flattenPageMenus(menus), [menus]);
  const currentTrail = useMemo(() => findMenuTrail(menus, normalizePath(location.pathname)), [menus, location.pathname]);
  const menuItems = useMemo(() => menus.map(toMenuItem), [menus]);
  const pageTitle = currentTrail.at(-1)?.name ?? 'Workspace';
  const breadcrumbItems = [{ title: 'Home' }, ...currentTrail.map((item) => ({ title: item.name }))];

  // Tab bar state
  interface TabItem { key: string; label: string; path: string }
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [pageRefreshKey, setPageRefreshKey] = useState(0);

  const addTab = useCallback((path: string, label: string) => {
    const key = path;
    setTabs((prev) => {
      if (prev.some((t) => t.key === key)) return prev;
      return [...prev, { key, label, path }];
    });
    setActiveTab(key);
  }, []);

  const removeTab = useCallback((key: string) => {
    const currentTabs = tabs;
    const closingActive = key === activeTab;
    let fallback: { key: string; path: string } | null = null;
    if (closingActive) {
      const remaining = currentTabs.filter((t) => t.key !== key);
      if (remaining.length > 0) {
        const idx = currentTabs.findIndex((t) => t.key === key);
        fallback = remaining[Math.min(idx, remaining.length - 1)];
      }
    }

    setTabs((prev) => prev.filter((t) => t.key !== key));

    if (fallback) {
      setActiveTab(fallback.key);
      navigate(fallback.path);
    }
  }, [activeTab, navigate, tabs]);

  const activateTab = useCallback((tab: TabItem | undefined) => {
    if (!tab) {
      const fallback = flatMenus.find((m) => m.path === '/dashboard') ?? flatMenus[0];
      if (fallback) {
        navigate(fallback.path);
      }
      return;
    }
    setActiveTab(tab.key);
    navigate(tab.path);
  }, [flatMenus, navigate]);

  const closeCurrentTab = useCallback((key = activeTab) => {
    const currentTabs = tabs;
    const closingActive = key === activeTab;
    let fallback: TabItem | undefined;
    if (closingActive) {
      const remaining = currentTabs.filter((tab) => tab.key !== key);
      if (remaining.length > 0) {
        const index = currentTabs.findIndex((tab) => tab.key === key);
        fallback = remaining[Math.min(index, remaining.length - 1)];
      }
    }

    setTabs((prev) => prev.filter((tab) => tab.key !== key));

    if (closingActive) {
      if (fallback) {
        setActiveTab(fallback.key);
        navigate(fallback.path);
      } else {
        const dash = flatMenus.find((m) => m.path === '/dashboard') ?? flatMenus[0];
        if (dash) navigate(dash.path);
      }
    }
  }, [activeTab, navigate, tabs, flatMenus]);

  const closeOtherTabs = useCallback((key = activeTab) => {
    const currentTabs = tabs;
    const target = currentTabs.find((tab) => tab.key === key);
    setTabs((prev) => prev.filter((tab) => tab.key === key));
    activateTab(target);
  }, [activateTab, activeTab, tabs]);

  const closeTabsToLeft = useCallback((key = activeTab) => {
    const index = tabs.findIndex((tab) => tab.key === key);
    if (index <= 0) return;
    const next = tabs.slice(index);
    const activeInNext = next.some((tab) => tab.key === activeTab);

    setTabs((prev) => {
      const idx = prev.findIndex((tab) => tab.key === key);
      if (idx <= 0) return prev;
      return prev.slice(idx);
    });

    if (!activeInNext && next.length > 0) {
      setActiveTab(next[0].key);
      navigate(next[0].path);
    }
  }, [activeTab, navigate, tabs]);

  const closeTabsToRight = useCallback((key = activeTab) => {
    const index = tabs.findIndex((tab) => tab.key === key);
    if (index < 0 || index >= tabs.length - 1) return;
    const next = tabs.slice(0, index + 1);
    const activeInNext = next.some((tab) => tab.key === activeTab);

    setTabs((prev) => {
      const idx = prev.findIndex((tab) => tab.key === key);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      return prev.slice(0, idx + 1);
    });

    if (!activeInNext && next.length > 0) {
      setActiveTab(next[next.length - 1].key);
      navigate(next[next.length - 1].path);
    }
  }, [activeTab, navigate, tabs]);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTab('');
    const fallback = flatMenus.find((m) => m.path === '/dashboard') ?? flatMenus[0];
    if (fallback) {
      navigate(fallback.path);
    }
  }, [flatMenus, navigate]);

  const refreshCurrentPage = useCallback(() => {
    setPageRefreshKey((value) => value + 1);
  }, []);

  // Auto-add tab on navigation
  useEffect(() => {
    const path = normalizePath(location.pathname);
    if (path === '/' || path === '/login') return;
    const menu = flatMenus.find((m) => m.path === path);
    if (menu) {
      addTab(path, menu.label);
    }
  }, [location.pathname, flatMenus, addTab]);

  // Initialize tabs
  useEffect(() => {
    if (tabs.length === 0 && flatMenus.length > 0) {
      const dash = flatMenus.find((m) => m.path === '/dashboard');
      if (dash) addTab('/dashboard', dash.label);
    }
  }, [flatMenus, tabs.length, addTab]);

  useEffect(() => {
    if (!collapsed) {
      setOpenKeys(activeMenu.openKeys);
    }
  }, [activeMenu.openKeys, collapsed]);

  useEffect(() => {
    void unreadNotificationCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, []);

  // Shared WebSocket for notification badge
  const { onMessage: onWsMessage } = useNotificationWebSocket();
  useEffect(() => {
    onWsMessage((data) => {
      if (data.event === 'unread_count') {
        setUnreadCount(data.count ?? 0);
      }
      if (data.event === 'notifications_changed') {
        void unreadNotificationCount().then(setUnreadCount).catch(() => setUnreadCount(0));
      }
    });
  }, [onWsMessage]);

  return (
    <Layout className={`app-shell app-shell-${layoutMode}`}>
      {layoutMode === 'side' && (
        <Sider trigger={null} collapsible collapsed={collapsed} width={236} className={`app-sider app-sider-${sidebarTheme}`}>
          <div className="app-logo">
            <span className="app-logo-mark">ED</span>
            {!collapsed && <span className="app-logo-text">Enterprise Demo</span>}
          </div>
          <Menu
            theme={sidebarTheme}
            mode="inline"
            selectedKeys={activeMenu.selectedKey ? [activeMenu.selectedKey] : []}
            openKeys={collapsed ? [] : openKeys}
            onOpenChange={setOpenKeys}
            onClick={({ key }) => {
              if (String(key).startsWith('/')) {
                navigate(key);
              }
            }}
            items={menuItems}
          />
        </Sider>
      )}
      <Layout>
        <Header className={`app-header app-header-${headerStyle}`}>
          <div className="header-left">
            {layoutMode === 'side' ? (
              <>
                <Button
                  type="text"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setCollapsed(!collapsed)}
                />
                <div className="page-heading">
                  <Typography.Text className="page-title">{pageTitle}</Typography.Text>
                  {showBreadcrumb && <Breadcrumb items={breadcrumbItems} />}
                </div>
              </>
            ) : (
              <>
                <div className="app-top-logo" onClick={() => navigate('/dashboard')}>
                  <span className="app-logo-mark">ED</span>
                  <span className="app-logo-text">Enterprise Demo</span>
                </div>
                <Menu
                  className="app-top-menu"
                  mode="horizontal"
                  selectedKeys={activeMenu.selectedKey ? [activeMenu.selectedKey] : []}
                  onClick={({ key }) => {
                    if (String(key).startsWith('/')) {
                      navigate(key);
                    }
                  }}
                  items={menuItems}
                />
              </>
            )}
          </div>
          <div className="header-actions">
            {showPageSearch && (
              <Select
                showSearch
                allowClear
                className="menu-search"
                placeholder="Search pages"
                optionFilterProp="label"
                options={flatMenus.map((item) => ({ value: item.path, label: item.label }))}
                onSelect={(path) => navigate(path)}
              />
            )}
            <Badge count={unreadCount} overflowCount={99} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                aria-label="Notifications"
                onClick={() => navigate('/collaboration/notifications')}
              />
            </Badge>
            <Button
              type="text"
              icon={<ControlOutlined />}
              aria-label="全局外观"
              onClick={() => setAppearanceOpen(true)}
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
          </div>
        </Header>
        <Content className="app-content">
          {tabs.length > 0 && (
            <Tabs
              className={`workspace-tabs workspace-tabs-${tabStyle}`}
              type={tabStyle === 'card' ? 'editable-card' : 'line'}
              size="small"
              hideAdd
              activeKey={activeTab}
              onChange={(key) => { setActiveTab(key); navigate(key); }}
              onEdit={(key, action) => { if (action === 'remove') removeTab(key as string); }}
              tabBarExtraContent={{
                right: (
                  <Space size={4} className="workspace-tab-actions">
                    <Button type="text" size="small" icon={<ReloadOutlined />} onClick={refreshCurrentPage} aria-label="刷新当前页" />
                    <Button type="text" size="small" onClick={closeAllTabs}>关闭全部</Button>
                  </Space>
                ),
              }}
              items={tabs.map((t) => ({
                key: t.key,
                label: (
                  <Dropdown
                    trigger={['contextMenu']}
                    menu={{
                      items: [
                        { key: 'refresh', icon: <ReloadOutlined />, label: '刷新当前页' },
                        { type: 'divider' },
                        { key: 'close', label: '关闭当前' },
                        { key: 'closeOthers', label: '关闭其他' },
                        { key: 'closeLeft', label: '关闭左侧' },
                        { key: 'closeRight', label: '关闭右侧' },
                        { key: 'closeAll', danger: true, label: '关闭全部' },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'refresh') {
                          activateTab(t);
                          refreshCurrentPage();
                        }
                        if (key === 'close') closeCurrentTab(t.key);
                        if (key === 'closeOthers') closeOtherTabs(t.key);
                        if (key === 'closeLeft') closeTabsToLeft(t.key);
                        if (key === 'closeRight') closeTabsToRight(t.key);
                        if (key === 'closeAll') closeAllTabs();
                      },
                    }}
                  >
                    <span className="workspace-tab-label">{t.label}</span>
                  </Dropdown>
                ),
                closable: tabs.length > 1,
              }))}
              tabBarStyle={{ marginBottom: 0 }}
            />
          )}
          <div className={`page-body page-body-${contentPadding} page-body-${pageTone}`}>
            <ErrorBoundary>
              <Outlet key={`${location.pathname}:${pageRefreshKey}`} />
            </ErrorBoundary>
          </div>
          <AppearanceDrawer open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
          <FloatingAIAssistant />
        </Content>
      </Layout>
    </Layout>
  );
}

function AppearanceDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const primaryColor = useAppearanceStore((state) => state.primaryColor);
  const borderRadius = useAppearanceStore((state) => state.borderRadius);
  const density = useAppearanceStore((state) => state.density);
  const sidebarTheme = useAppearanceStore((state) => state.sidebarTheme);
  const contentPadding = useAppearanceStore((state) => state.contentPadding);
  const tabStyle = useAppearanceStore((state) => state.tabStyle);
  const headerStyle = useAppearanceStore((state) => state.headerStyle);
  const pageTone = useAppearanceStore((state) => state.pageTone);
  const layoutMode = useAppearanceStore((state) => state.layoutMode);
  const showBreadcrumb = useAppearanceStore((state) => state.showBreadcrumb);
  const showPageSearch = useAppearanceStore((state) => state.showPageSearch);
  const setPrimaryColor = useAppearanceStore((state) => state.setPrimaryColor);
  const setBorderRadius = useAppearanceStore((state) => state.setBorderRadius);
  const setDensity = useAppearanceStore((state) => state.setDensity);
  const setSidebarTheme = useAppearanceStore((state) => state.setSidebarTheme);
  const setContentPadding = useAppearanceStore((state) => state.setContentPadding);
  const setTabStyle = useAppearanceStore((state) => state.setTabStyle);
  const setHeaderStyle = useAppearanceStore((state) => state.setHeaderStyle);
  const setPageTone = useAppearanceStore((state) => state.setPageTone);
  const setLayoutMode = useAppearanceStore((state) => state.setLayoutMode);
  const setShowBreadcrumb = useAppearanceStore((state) => state.setShowBreadcrumb);
  const setShowPageSearch = useAppearanceStore((state) => state.setShowPageSearch);
  const reset = useAppearanceStore((state) => state.reset);

  return (
    <Drawer title="全局外观" open={open} onClose={onClose} width={360} zIndex={1300} extra={<Button onClick={reset}>恢复默认</Button>}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div className="appearance-field">
          <Typography.Text strong>主题色</Typography.Text>
          <ColorPicker value={primaryColor} showText onChangeComplete={(color) => setPrimaryColor(color.toHexString())} />
          <div className="appearance-swatches">
            {['#1677ff', '#0f766e', '#7c3aed', '#dc2626', '#ea580c', '#475467'].map((color) => (
              <button
                key={color}
                type="button"
                className="appearance-swatch"
                style={{ background: color }}
                aria-label={`设置主题色 ${color}`}
                onClick={() => setPrimaryColor(color)}
              />
            ))}
          </div>
        </div>

        <Divider style={{ margin: 0 }} />

        <div className="appearance-field">
          <Typography.Text strong>布局模式</Typography.Text>
          <Segmented
            block
            value={layoutMode}
            options={[
              { label: '左侧菜单', value: 'side' },
              { label: '顶部菜单', value: 'top' },
            ]}
            onChange={(value) => setLayoutMode(value as LayoutMode)}
          />
        </div>

        <div className="appearance-field">
          <Typography.Text strong>界面密度</Typography.Text>
          <Segmented
            block
            value={density}
            options={[
              { label: '舒适', value: 'comfortable' },
              { label: '标准', value: 'middle' },
              { label: '紧凑', value: 'compact' },
            ]}
            onChange={(value) => setDensity(value as Density)}
          />
        </div>

        <div className="appearance-field">
          <Typography.Text strong>页面留白</Typography.Text>
          <Segmented
            block
            value={contentPadding}
            options={[
              { label: '宽松', value: 'spacious' },
              { label: '标准', value: 'standard' },
              { label: '紧凑', value: 'compact' },
            ]}
            onChange={(value) => setContentPadding(value as ContentPadding)}
          />
        </div>

        <div className="appearance-field">
          <Typography.Text strong>内容背景</Typography.Text>
          <Segmented
            block
            value={pageTone}
            options={[
              { label: '浅灰', value: 'gray' },
              { label: '纯白', value: 'white' },
            ]}
            onChange={(value) => setPageTone(value as PageTone)}
          />
        </div>

        <div className="appearance-field">
          <Typography.Text strong>标签样式</Typography.Text>
          <Segmented
            block
            value={tabStyle}
            options={[
              { label: '卡片', value: 'card' },
              { label: '线条', value: 'line' },
            ]}
            onChange={(value) => setTabStyle(value as TabStyle)}
          />
        </div>

        <div className="appearance-field">
          <Typography.Text strong>页头风格</Typography.Text>
          <Segmented
            block
            value={headerStyle}
            options={[
              { label: '玻璃', value: 'glass' },
              { label: '纯色', value: 'solid' },
            ]}
            onChange={(value) => setHeaderStyle(value as HeaderStyle)}
          />
        </div>

        <div className="appearance-field">
          <Typography.Text strong>侧栏风格</Typography.Text>
          <Segmented
            block
            value={sidebarTheme}
            options={[
              { label: '深色', value: 'dark' },
              { label: '浅色', value: 'light' },
            ]}
            onChange={(value) => setSidebarTheme(value as SidebarTheme)}
          />
        </div>

        <div className="appearance-field">
          <Typography.Text strong>圆角</Typography.Text>
          <Slider min={2} max={12} value={borderRadius} onChange={setBorderRadius} />
        </div>

        <Divider style={{ margin: 0 }} />

        <div className="appearance-switch-row">
          <Typography.Text strong>显示面包屑</Typography.Text>
          <Switch checked={showBreadcrumb} onChange={setShowBreadcrumb} />
        </div>
        <div className="appearance-switch-row">
          <Typography.Text strong>显示页面搜索</Typography.Text>
          <Switch checked={showPageSearch} onChange={setShowPageSearch} />
        </div>
      </Space>
    </Drawer>
  );
}

const iconMap: Record<string, ReactNode> = {
  ApartmentOutlined: <ApartmentOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  AuditOutlined: <AuditOutlined />,
  BellOutlined: <BellOutlined />,
  BookOutlined: <BookOutlined />,
  BranchesOutlined: <BranchesOutlined />,
  CheckSquareOutlined: <CheckSquareOutlined />,
  ClockCircleOutlined: <ClockCircleOutlined />,
  ContactsOutlined: <ContactsOutlined />,
  ControlOutlined: <ControlOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  DatabaseOutlined: <DatabaseOutlined />,
  DeleteOutlined: <DeleteOutlined />,
  FileSearchOutlined: <FileSearchOutlined />,
  FolderOpenOutlined: <FolderOpenOutlined />,
  FolderOutlined: <FolderOutlined />,
  MenuOutlined: <MenuOutlined />,
  MessageOutlined: <MessageOutlined />,
  ReadOutlined: <ReadOutlined />,
  RobotOutlined: <RobotOutlined />,
  ScheduleOutlined: <ScheduleOutlined />,
  SettingOutlined: <SettingOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  TeamOutlined: <TeamOutlined />,
  UserOutlined: <UserOutlined />,
};

function toMenuItem(menu: MenuNode): any {
  const key = menu.path ? normalizePath(menu.path) : menu.code;
  return {
    key,
    icon: menu.icon ? (iconMap[menu.icon] ?? <AppstoreOutlined />) : undefined,
    label: menu.name,
    children: menu.children?.length ? menu.children.map(toMenuItem) : undefined,
    disabled: !menu.path && !menu.children?.length,
  };
}

function flattenPageMenus(menus: MenuNode[]) {
  const pages: Array<{ path: string; label: string }> = [];

  function visit(items: MenuNode[], parents: string[]) {
    for (const item of items) {
      const labelParts = [...parents, item.name];
      if (item.path) {
        pages.push({ path: normalizePath(item.path), label: labelParts.join(' / ') });
      }
      if (item.children?.length) {
        visit(item.children, labelParts);
      }
    }
  }

  visit(menus, []);
  return pages;
}

function findMenuTrail(menus: MenuNode[], pathname: string): MenuNode[] {
  let best: { trail: MenuNode[]; score: number } = { trail: [], score: -1 };

  function visit(items: MenuNode[], parents: MenuNode[]) {
    for (const item of items) {
      const trail = [...parents, item];
      const itemPath = item.path ? normalizePath(item.path) : '';
      if (itemPath && (pathname === itemPath || pathname.startsWith(`${itemPath}/`))) {
        const score = itemPath.length;
        if (score > best.score) {
          best = { trail, score };
        }
      }
      if (item.children?.length) {
        visit(item.children, trail);
      }
    }
  }

  visit(menus, []);
  return best.trail;
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
