import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pages = [
  'src/features/role/pages/RoleListPage.tsx',
  'src/features/department/pages/DepartmentListPage.tsx',
  'src/features/datadict/pages/DataDictPage.tsx',
  'src/features/settings/pages/SettingsPage.tsx',
];

describe('system mobile list pages', () => {
  it.each(pages)('uses ResponsiveProTable for auto-derived mobile cards in %s', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).toContain('ResponsiveProTable');
    // Columns are standard ProColumns — no mobile: metadata needed
    expect(source).not.toContain('mobile: { title: true');
    expect(source).not.toContain('MobileListColumn');
  });

  it('moves operation-heavy pages to mobile dropdown actions', () => {
    const role = readFileSync(resolve(process.cwd(), 'src/features/role/pages/RoleListPage.tsx'), 'utf8');
    expect(role).toContain('renderMobileActions');
    expect(role).toContain('aria-label="更多操作"');
    expect(role).toContain('icon={<MoreOutlined />}');
  });

  it('uses current Ant Design modal destroy prop names', () => {
    const checkedPages = [
      'src/features/role/pages/RoleListPage.tsx',
      'src/features/datadict/pages/DataDictPage.tsx',
      'src/features/scheduler/pages/SchedulerPage.tsx',
    ];
    for (const path of checkedPages) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(source).not.toContain('destroyOnClose');
    }
  });
});
