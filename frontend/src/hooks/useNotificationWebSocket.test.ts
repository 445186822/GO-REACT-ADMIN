import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/hooks/useNotificationWebSocket.ts'), 'utf8');

describe('useNotificationWebSocket source safeguards', () => {
  it('does not replace an in-flight websocket for the same token', () => {
    expect(source).toContain('sharedWs.readyState === WebSocket.CONNECTING');
    expect(source).toContain('activeToken === token');
  });

	it('polls the shared websocket state so late subscribers show the current connection status', () => {
		expect(source).toContain('setInterval');
		expect(source).toContain('sharedWs?.readyState === WebSocket.OPEN');
		expect(source).toContain('clearInterval');
	});

	it('exposes a manual reconnect action', () => {
		expect(source).toContain('reconnectNow');
		expect(source).toContain('return { connected, onMessage, reconnect: reconnectNow }');
	});

  it('connects to the announcement realtime channel', () => {
    expect(source).toContain('/api/v1/announcements/ws?token=');
  });
});
