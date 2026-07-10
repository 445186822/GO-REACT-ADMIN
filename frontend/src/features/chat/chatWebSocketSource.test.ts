import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/chat/hooks/useChatWebSocket.ts'), 'utf8');
const pageSource = readFileSync(resolve(process.cwd(), 'src/features/chat/pages/ChatPage.tsx'), 'utf8');

describe('chat websocket source safeguards', () => {
  it('does not replace an in-flight websocket for the same token', () => {
    expect(source).toContain('ws.readyState === WebSocket.CONNECTING');
    expect(source).toContain('activeToken === token');
  });

  it('defers disconnect cleanup to avoid React StrictMode closing connecting sockets immediately', () => {
    expect(source).toContain('disconnectTimer');
    expect(source).toContain('scheduleDisconnect');
    expect(source).toContain('clearDisconnectTimer');
  });

  it('handles missing authenticated images without unhandled promise rejections', () => {
    expect(pageSource).toContain('.catch(() =>');
    expect(pageSource).toContain('图片已失效');
  });
});
