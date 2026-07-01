import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/collaboration/pages/WorkflowPage.tsx'), 'utf8');
const apiSource = readFileSync(resolve(process.cwd(), 'src/api/collaboration.ts'), 'utf8');

describe('workflow business status configuration', () => {
  it('separates workflow instance status from business object status in designer config', () => {
    expect(source).toContain('通过后流程状态');
    expect(source).toContain('驳回后流程状态');
    expect(source).toContain('通过后业务状态');
    expect(source).toContain('驳回后业务状态');
    expect(source).toContain('finalBusinessStatus');
    expect(source).toContain('业务类型');
    expect(source).toContain('业务适配器');
    expect(source).toContain('业务状态字典');
    expect(source).toContain('businessStatus?: string');
    expect(apiSource).toContain('business_status?: string');
    expect(apiSource).toContain('status_dict_code?: string');
    expect(apiSource).toContain('adapter_code?: string');
  });
});
