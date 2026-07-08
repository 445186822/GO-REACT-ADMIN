import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/menu/pages/MenuListPage.tsx'), 'utf8');

describe('menu mobile list', () => {
  it('uses ResponsiveProTable with standard ProColumns — no mobile metadata', () => {
    expect(source).toContain('ResponsiveProTable');
    expect(source).not.toContain('mobile: { title: true');
    expect(source).not.toContain('MobileListColumn');
    expect(source).toContain('columns={columns}');
  });

  it('moves menu row actions into mobile dropdown items', () => {
    expect(source).toContain('renderMobileActions');
    expect(source).toContain('getMenuActionMenuItems');
    expect(source).toContain('aria-label="更多操作"');
    expect(source).toContain('icon={<MoreOutlined />}');
  });
});
