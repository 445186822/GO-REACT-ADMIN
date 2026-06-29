import { describe, expect, it } from 'vitest';
import { operationColumnProps } from './tableColumns';

describe('table column helpers', () => {
  it('fixes operation columns on the right with a usable default width', () => {
    expect(operationColumnProps()).toMatchObject({
      valueType: 'option',
      fixed: 'right',
      width: 180,
    });
  });

  it('never returns an operation column narrower than the standard minimum', () => {
    expect(operationColumnProps(100).width).toBe(180);
    expect(operationColumnProps(260).width).toBe(260);
  });
});
