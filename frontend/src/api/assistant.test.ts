import { describe, expect, it, vi } from 'vitest';
import { sendAssistantMessage } from './assistant';
import { http } from '../request/http';

vi.mock('../request/http', () => ({
  http: {
    post: vi.fn(),
  },
}));

describe('assistant api', () => {
  it('uses the persisted collaboration assistant endpoint', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: { reply: 'ok' } });

    const reply = await sendAssistantMessage('hello');

    expect(reply).toBe('ok');
    expect(http.post).toHaveBeenCalledWith('/ai-assistant/chat', { message: 'hello' });
  });
});
