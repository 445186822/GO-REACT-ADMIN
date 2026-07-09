import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/chat/hooks/useChatWebSocket.ts'), 'utf8');

describe('chat websocket source safeguards', () => {
  it('defers disconnect cleanup to avoid React StrictMode closing connecting sockets immediately', () => {
    expect(source).toContain('disconnectTimer');
    expect(source).toContain('scheduleDisconnect');
    expect(source).toContain('clearDisconnectTimer');
  });
});
