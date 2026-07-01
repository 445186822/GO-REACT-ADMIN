import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');

describe('header account and role menus', () => {
  it('keeps account actions and role switching in separate dropdowns', () => {
    expect(source).toContain('handleAccountMenuClick');
    expect(source).toContain('handleRoleMenuClick');
    expect(source).toContain('accountMenuItems');
    expect(source).toContain('roleMenuItems');

    const accountMenuMatch = source.match(/const accountMenuItems[\s\S]*?\n  const roleMenuItems/);
    expect(accountMenuMatch?.[0] ?? '').toContain("key: 'password'");
    expect(accountMenuMatch?.[0] ?? '').toContain("key: 'logout'");
    expect(accountMenuMatch?.[0] ?? '').not.toContain('role:');
    expect(source).toContain('className="identity-menu-group"');
    expect(source).toContain('className="identity-menu-separator"');

    const roleTriggerMatch = source.match(/<button[\s\S]*?className="role-menu"[\s\S]*?<\/button>/);
    expect(roleTriggerMatch?.[0] ?? '').toContain('{activeRole.name}');
    expect(roleTriggerMatch?.[0] ?? '').not.toContain('TeamOutlined');
    expect(roleTriggerMatch?.[0] ?? '').not.toContain('DownOutlined');

    const roleMenuMatch = source.match(/const roleMenuItems[\s\S]*?\n  \);/);
    expect(roleMenuMatch?.[0] ?? '').toContain('{role.name}');
    expect(roleMenuMatch?.[0] ?? '').not.toContain('icon:');
    const roleMenuLabelMatch = roleMenuMatch?.[0].match(/label:[^\n]*/);
    expect(roleMenuLabelMatch?.[0] ?? '').not.toContain('role.code');
  });
});
