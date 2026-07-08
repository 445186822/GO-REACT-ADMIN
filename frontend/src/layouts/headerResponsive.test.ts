import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('mobile header responsive behavior', () => {
  it('keeps breadcrumbs out of the compact mobile header', () => {
    expect(source).toContain('shouldShowHeaderBreadcrumb');
    expect(source).toContain('{shouldShowHeaderBreadcrumb && <Breadcrumb items={breadcrumbItems} />}');
    expect(css).toContain('.page-heading .ant-breadcrumb');
    expect(css).toContain('display: none');
  });

  it('keeps role switching visible in the mobile account area', () => {
    expect(css).toContain('.identity-menu-group');
    expect(css).toContain('.role-menu');
    expect(css).not.toContain('.user-menu-info,\n  .identity-menu-separator,\n  .role-menu {\n    display: none;');
    expect(css).toContain('max-width: 64px');
  });
});
