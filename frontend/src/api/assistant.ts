import { http } from '../request/http';

export async function sendAssistantMessage(message: string) {
  const res = await http.post<unknown, { data: { reply: string } }>('/ai-assistant/chat', { message });
  return res.data.reply;
}
