import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/menu/pages/MenuListPage.tsx'), 'utf8');

describe('menu mobile list', () => {
  it('uses mobile metadata and MobileRecordList without changing desktop ProTable', () => {
    expect(source).toContain('MobileRecordList');
    expect(source).toContain('mobile: { title: true, visible: true, priority: 1 }');
    expect(source).toContain('mobile: { visible: true, priority: 2 }');
    expect(source).toContain('<ProTable<MenuTreeRow>');
  });

  it('moves menu row actions into mobile dropdown items', () => {
    expect(source).toContain('getMenuActionMenuItems(row)');
    expect(source).toContain('aria-label="更多操作"');
    expect(source).toContain('icon={<MoreOutlined />}');
  });
});
