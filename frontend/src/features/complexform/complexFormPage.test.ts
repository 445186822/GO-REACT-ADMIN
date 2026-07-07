import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(process.cwd(), 'src/features/complexform/pages/ComplexFormPage.tsx');
const apiPath = resolve(process.cwd(), 'src/api/complexForms.ts');

describe('complex form business example', () => {
  it('has a route-backed API and a broad set of form controls', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(existsSync(apiPath)).toBe(true);

    const pageSource = readFileSync(pagePath, 'utf8');
    const apiSource = readFileSync(apiPath, 'utf8');

    expect(apiSource).toContain('/complex-forms');
    expect(apiSource).toContain('createComplexForm');
    expect(apiSource).toContain('updateComplexForm');
    expect(apiSource).toContain('deleteComplexForm');

    [
      'ProFormText',
      'ProFormTextArea',
      'ProFormDigit',
      'ProFormMoney',
      'ProFormDatePicker',
      'ProFormDateRangePicker',
      'ProFormTimePicker',
      'ProFormRadio.Group',
      'ProFormCheckbox.Group',
      'ProFormSwitch',
      'ProFormRate',
      'ProFormSlider',
      'ProFormDependency',
    ].forEach((token) => expect(pageSource).toContain(token));

    expect(pageSource).toContain('form_extra');
    expect(pageSource).toContain('Permission code="complex-form:create"');
    expect(pageSource).toContain('Permission code="complex-form:update"');
    expect(pageSource).toContain('Permission code="complex-form:delete"');
  });
});
