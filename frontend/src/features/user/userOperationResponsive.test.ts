import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/user/pages/UserListPage.tsx'), 'utf8');

describe('user table mobile operation column', () => {
  it('uses ResponsiveProTable with auto-derived mobile cards', () => {
    expect(source).toContain('ResponsiveProTable');
    expect(source).not.toContain('mobile: { title: true');
    expect(source).not.toContain('MobileListColumn');
  });

  it('keeps business fields available through horizontal scrolling on mobile', () => {
    expect(source).not.toContain('hideInTable: isMobile');
  });

  it('moves row actions into one dropdown trigger on mobile', () => {
    expect(source).toContain('renderMobileActions');
    expect(source).toContain('getUserActionMenuItems');
    expect(source).toContain('aria-label="更多操作"');
    expect(source).toContain('icon={<MoreOutlined />}');
  });
});
