import { describe, expect, it } from 'vitest';
import { enterpriseRoutes } from './lazyRoutes';

describe('enterprise lazy routes', () => {
  it('keeps heavy enterprise pages behind lazy imports', () => {
    expect(enterpriseRoutes.find((route) => route.path === 'collaboration/workflows')?.permission).toBe('workflow:view');
    expect(enterpriseRoutes.find((route) => route.path === 'knowledge-base')?.permission).toBe('kb:view');
    expect(enterpriseRoutes.every((route) => typeof route.loader === 'function')).toBe(true);
  });
});
