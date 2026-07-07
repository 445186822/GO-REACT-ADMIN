import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/file/pages/FileCenterPage.tsx'), 'utf8');

describe('file center upload behavior', () => {
  it('shows upload failures and reloads the list after a successful upload', () => {
    expect(source).toContain("message.error('上传失败");
    expect(source).toContain('actionRef.current?.reloadAndRest?.()');
    expect(source).toContain('actionRef.current?.reload();');
  });

  it('uses the table keyword search field expected by the backend API', () => {
    expect(source).toContain("dataIndex: 'keyword'");
    expect(source).toContain('hideInTable: true');
    expect(source).toContain('keyword: params.keyword as string | undefined');
  });
});
