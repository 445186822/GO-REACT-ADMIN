import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');

describe('main entry', () => {
  it('loads the Ant Design React 19 compatibility patch before rendering', () => {
    expect(source.trimStart().startsWith("import '@ant-design/v5-patch-for-react-19';")).toBe(true);
  });
});
