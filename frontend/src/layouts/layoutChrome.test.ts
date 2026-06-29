import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const featureSources = [
  'src/features/customer/pages/CustomerListPage.tsx',
  'src/features/collaboration/pages/MessageTemplatePage.tsx',
  'src/features/collaboration/pages/NotificationCenterPage.tsx',
  'src/features/knowledgebase/pages/KnowledgeBasePage.tsx',
  'src/features/settings/pages/SettingsPage.tsx',
  'src/features/collaboration/pages/WorkflowPage.tsx',
].map((path) => readFileSync(resolve(process.cwd(), path), 'utf8'));
const fileCenterSource = readFileSync(resolve(process.cwd(), 'src/features/file/pages/FileCenterPage.tsx'), 'utf8');

function blockFor(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
  return match?.[1] ?? '';
}

describe('layout chrome visual boundaries', () => {
  test('separates header tabs and page content into distinct bands', () => {
    expect(blockFor('.app-header::after')).toContain('height: 1px');
    expect(blockFor('.workspace-tabs::before')).toContain('height: 1px');
    expect(blockFor('.page-body::before')).toContain('height: 1px');
    expect(blockFor('.workspace-tabs')).toContain('top: 0');
  });

  test('removes duplicate content headings and gives inner tabs a clear section boundary', () => {
    expect(featureSources.join('\n')).not.toMatch(/Typography\.Title level=\{3\}|<Title level=\{3\}|<Title level=\{4\}/);
    expect(blockFor('.page-body .ant-tabs-top > .ant-tabs-nav')).toContain('border: 1px solid #dfe5ee');
    expect(blockFor('.page-body .ant-tabs-tab-active')).toContain('background: #fff');
  });

  test('prevents file center table and browser scrollbar jitter', () => {
    expect(fileCenterSource).not.toContain('scroll={{ x: 1000 }}');
    expect(blockFor('html')).toContain('scrollbar-gutter: stable');
  });
});
