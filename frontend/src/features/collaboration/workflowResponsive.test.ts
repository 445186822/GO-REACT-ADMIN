import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/collaboration/pages/WorkflowPage.tsx'), 'utf8');
const layoutSource = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('workflow engine responsive layout', () => {
  it('uses viewport-aware compact table actions on mobile', () => {
    expect(source).toContain('Grid.useBreakpoint()');
    expect(source).toContain('viewportWidth <= 768');
    expect(source).toContain('workflow-table-actions');
    expect(source).toContain('operationColumnProps<WorkflowRow>(isMobile ? 156 : 320)');
    expect(source).toContain("scroll={{ x: isMobile ? 560 : 'max-content' }}");
  });

  it('gives workflow tabs and the visual designer mobile-specific structure', () => {
    expect(source).toContain('className="workflow-page"');
    expect(source).toContain('className="workflow-page-tabs"');
    expect(source).toContain('workflow-flow-drawer-title');
    expect(source).toContain('workflow-flow-drawer-footer');
    expect(source).toContain('workflow-node-type-grid');
    expect(source).toContain("width={isMobile ? '100%' : '100vw'}");
  });

  it('keeps the realtime notification popover inside narrow viewports', () => {
    expect(layoutSource).toContain("placement={isMobile ? 'bottom' : 'bottomRight'}");
    expect(layoutSource).toContain("classNames={{ root: 'notification-popover-overlay' }}");
    expect(css).toContain('.notification-popover-overlay');
    expect(css).toContain('width: min(320px, calc(100vw - 24px))');
  });
});
