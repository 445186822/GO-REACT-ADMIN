import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/user/pages/UserListPage.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('user table mobile operation column', () => {
  it('uses a compact action column on mobile', () => {
    expect(source).toContain('Grid.useBreakpoint()');
    expect(source).toContain('const isMobile = screens.md === false || viewportWidth <= 768;');
    expect(source).toContain('MobileRecordList');
    expect(source).toContain('mobile: { title: true, visible: true, priority: 1 }');
    expect(source).toContain('mobile: { visible: true, priority: 2 }');
    expect(css).toContain('width: 64px !important');
  });

  it('keeps business fields available through horizontal scrolling on mobile', () => {
    expect(source).not.toContain('hideInTable: isMobile');
    expect(css).not.toContain('.user-table-mobile .ant-table col:first-child');
    expect(css).not.toContain('width: calc(100% - 64px) !important');
  });

  it('moves row actions into one dropdown trigger on mobile', () => {
    expect(source).toContain('getUserActionMenuItems(row)');
    expect(source).toContain('<Dropdown menu={{ items }} trigger={[\'click\']} placement="bottomRight">');
    expect(source).toContain('aria-label="更多操作"');
    expect(source).toContain('icon={<MoreOutlined />}');
  });
});
