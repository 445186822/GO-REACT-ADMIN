import { describe, expect, it } from 'vitest';
import { enterpriseRoutes } from './lazyRoutes';

describe('enterprise lazy routes', () => {
  it('keeps heavy enterprise pages behind lazy imports', () => {
    expect(enterpriseRoutes.find((route) => route.path === 'collaboration/workflows')?.permission).toBe('workflow:view');
    expect(enterpriseRoutes.find((route) => route.path === 'collaboration/todos')?.permission).toBe('todo:view');
    expect(enterpriseRoutes.find((route) => route.path === 'knowledge-base')?.permission).toBe('kb:view');
    expect(enterpriseRoutes.find((route) => route.path === 'business/complex-forms')?.permission).toBe('complex-form:view');
    expect(enterpriseRoutes.find((route) => route.path === 'business/code-generator')?.permission).toBe('code-generator:view');
    expect(enterpriseRoutes.find((route) => route.path === 'system/architecture')?.permission).toBe('architecture:view');
    expect(enterpriseRoutes.find((route) => route.path === 'system/queue-lab/kafka')?.permission).toBe('queue:kafka');
    expect(enterpriseRoutes.find((route) => route.path === 'system/queue-lab/rabbitmq')?.permission).toBe('queue:rabbitmq');
    expect(enterpriseRoutes.find((route) => route.path === 'system/queue-lab/tcp')?.permission).toBe('queue:tcp');
    expect(enterpriseRoutes.find((route) => route.path === 'system/queue-lab/udp')?.permission).toBe('queue:udp');
    expect(enterpriseRoutes.find((route) => route.path === 'system/queue-lab/mqtt')?.permission).toBe('queue:mqtt');
    expect(enterpriseRoutes.every((route) => typeof route.loader === 'function')).toBe(true);
  });
});
