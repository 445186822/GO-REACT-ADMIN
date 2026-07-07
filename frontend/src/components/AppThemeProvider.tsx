import { App as AntdApp, ConfigProvider, Empty, theme as antdTheme, type ThemeConfig } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useEffect, type ReactNode } from 'react';
import { useShallow } from 'zustand/shallow';
import { useAppearanceStore } from '../store/appearanceStore';
import { initAppApi } from '../utils/message';

const sizeMap = {
  comfortable: 'large',
  middle: 'middle',
  compact: 'small',
} as const;

/** Inner component — must live inside <AntdApp> so App.useApp() works */
function MessageInit({ children }: { children: ReactNode }) {
  const app = AntdApp.useApp();
  useEffect(() => {
    initAppApi({ message: app.message, modal: app.modal, notification: app.notification });
  }, [app]);
  return <>{children}</>;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const {
    primaryColor, borderRadius, density, sidebarTheme,
    contentPadding, tabStyle, headerStyle, pageTone,
    layoutMode, showBreadcrumb, showPageSearch,
  } = useAppearanceStore(useShallow((state) => ({
    primaryColor: state.primaryColor,
    borderRadius: state.borderRadius,
    density: state.density,
    sidebarTheme: state.sidebarTheme,
    contentPadding: state.contentPadding,
    tabStyle: state.tabStyle,
    headerStyle: state.headerStyle,
    pageTone: state.pageTone,
    layoutMode: state.layoutMode,
    showBreadcrumb: state.showBreadcrumb,
    showPageSearch: state.showPageSearch,
  })));

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--app-primary', primaryColor);
    root.style.setProperty('--app-radius', `${borderRadius}px`);
    root.dataset.density = density;
    root.dataset.sidebar = sidebarTheme;
    root.dataset.contentPadding = contentPadding;
    root.dataset.tabStyle = tabStyle;
    root.dataset.headerStyle = headerStyle;
    root.dataset.pageTone = pageTone;
    root.dataset.layoutMode = layoutMode;
    root.dataset.showBreadcrumb = String(showBreadcrumb);
    root.dataset.showPageSearch = String(showPageSearch);
  }, [borderRadius, contentPadding, density, headerStyle, layoutMode, pageTone, primaryColor, showBreadcrumb, showPageSearch, sidebarTheme, tabStyle]);

  const theme: ThemeConfig = {
    algorithm: density === 'compact' ? antdTheme.compactAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primaryColor,
      borderRadius,
      colorBgLayout: '#f5f7fb',
      colorTextBase: '#101828',
      colorBorder: '#e4e7ec',
      controlHeight: density === 'comfortable' ? 36 : density === 'compact' ? 28 : 32,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    components: {
      Card: {
        borderRadiusLG: borderRadius,
      },
      Layout: {
        headerBg: '#fff',
        bodyBg: '#f5f7fb',
        siderBg: sidebarTheme === 'dark' ? '#0b1220' : '#fff',
      },
      Menu: {
        darkItemBg: '#0b1220',
        darkSubMenuItemBg: '#101828',
        itemBorderRadius: Math.min(borderRadius, 8),
      },
      Table: {
        headerBg: '#f8fafc',
        rowHoverBg: '#f9fafb',
      },
    },
  };

  return (
    <ConfigProvider
      locale={zhCN}
      componentSize={sizeMap[density]}
      theme={theme}
      renderEmpty={() => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
    >
      <AntdApp>
        <MessageInit>
          {children}
        </MessageInit>
      </AntdApp>
    </ConfigProvider>
  );
}
