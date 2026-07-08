import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('sidebar responsive navigation', () => {
  it('does not control submenu open keys while the desktop sidebar is collapsed', () => {
    expect(source).toContain('openKeys={options.collapsed ? undefined : openKeys}');
    expect(source).not.toContain('openKeys={collapsed ? [] : openKeys}');
    expect(source).toContain('handleMenuOpenChange');
  });

  it('uses a drawer menu on narrow side-layout screens instead of keeping the sidebar in the viewport', () => {
    expect(source).toContain('Grid.useBreakpoint()');
    expect(source).toContain('typeof window !==');
    expect(source).toContain('viewportWidth <= 768');
    expect(source).toContain("window.addEventListener('resize', handleResize)");
    expect(source).toContain('isMobileSideLayout');
    expect(source).toContain('mobileMenuOpen');
    expect(source).toContain('className={`mobile-menu-drawer mobile-menu-drawer-${sidebarTheme}`}');
  });

  it('has focused CSS for collapsed sidebar popups and mobile menu layout', () => {
    expect(css).toContain('.mobile-menu-drawer');
    expect(css).toContain('.app-shell-side .app-sider');
    expect(css).toContain('.app-shell-top .app-top-menu');
    expect(css).toContain('.page-body > div');
    expect(css).not.toContain('.app-sider.ant-layout-sider-collapsed .ant-menu-item');
    expect(css).not.toContain('padding-inline: 0 !important');
  });
});
