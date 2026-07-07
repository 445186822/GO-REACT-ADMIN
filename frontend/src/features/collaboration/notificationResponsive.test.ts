import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(resolve(process.cwd(), 'src/features/collaboration/pages/NotificationCenterPage.tsx'), 'utf8');
const modalSource = readFileSync(resolve(process.cwd(), 'src/features/collaboration/components/NotificationDetailModal.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('notification center responsive layout', () => {
  it('wraps the realtime status strip with wrap for mobile', () => {
    expect(pageSource).toContain('wrap');
    expect(pageSource).toContain('notification-status-strip');
  });

  it('keeps the detail modal usable on narrow screens', () => {
    expect(modalSource).toContain('min(680px, calc(100vw - 32px))');
    expect(modalSource).toContain('column={{ xs: 1, sm: 1, md: 2 }}');
    expect(modalSource).toContain('className="notification-detail-descriptions"');
  });

  it('defines shared responsive breakpoints for dense enterprise pages', () => {
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('.page-body > div');
    expect(css).toContain('.app-shell-top .app-top-menu');
    expect(css).toContain('.notification-detail-descriptions');
    expect(css).toContain('.ant-pro-table .ant-pro-table-list-toolbar');
  });
});
