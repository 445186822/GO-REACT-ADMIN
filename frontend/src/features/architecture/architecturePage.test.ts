import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/architecture/pages/ArchitecturePage.tsx'), 'utf8');

describe('architecture diagnostics page content', () => {
  test('presents multiple feature flow diagrams instead of a single overview', () => {
    expect(source).toContain('FLOW_DEFINITIONS');
    expect(source).toContain('系统总览');
    expect(source).toContain('登录菜单');
    expect(source).toContain('权限校验');
    expect(source).toContain('业务 CRUD');
    expect(source).toContain('工作流审批');
    expect(source).toContain('通知 WebSocket');
    expect(source).toContain('AI 助手');
    expect(source).toContain('定时任务');
  });

  test('includes troubleshooting matrix and important file index', () => {
    expect(source).toContain('TROUBLESHOOTING_MATRIX');
    expect(source).toContain('IMPORTANT_FILES');
    expect(source).toContain('菜单不显示');
    expect(source).toContain('接口 401 / 403');
    expect(source).toContain('backend/internal/http/middleware/route_permissions.go');
    expect(source).toContain('backend/internal/modules/collaboration/handler.go');
  });

  test('uses the top strip for actionable flow insights instead of a plain legend', () => {
    expect(source).toContain('FLOW_INSIGHTS');
    expect(source).toContain('关键接口');
    expect(source).toContain('关键数据');
    expect(source).toContain('排查入口');
    expect(source).not.toContain('architecture-layer-tag');
  });
});
