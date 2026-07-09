import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(resolve(process.cwd(), 'src/features/codegen/pages/CodeGeneratorPage.tsx'), 'utf8');
const apiSource = readFileSync(resolve(process.cwd(), 'src/api/codeGenerator.ts'), 'utf8');

describe('code generator page', () => {
  it('uses backend-provided business table options instead of free-form table input', () => {
    expect(pageSource).toContain('listCodegenTables');
    expect(pageSource).toContain('selectedTable');
    expect(pageSource).not.toContain('name="table_name"');
  });

  it('has preview and confirmed generation actions', () => {
    expect(pageSource).toContain('生成预览');
    expect(pageSource).toContain('确认生成');
    expect(pageSource).toContain('Modal.confirm');
  });

  it('renders generated file preview before writing files', () => {
    expect(pageSource).toContain('previewFiles');
    expect(pageSource).toContain('Tabs');
    expect(pageSource).toContain('file.content');
  });

  it('exposes typed code generator API functions', () => {
    expect(apiSource).toContain('listCodegenTables');
    expect(apiSource).toContain('getCodegenColumns');
    expect(apiSource).toContain('previewCodegen');
    expect(apiSource).toContain('generateCodegen');
  });
});
