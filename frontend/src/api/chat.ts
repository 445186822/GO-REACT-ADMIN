import { http } from '../request/http';

export type UserBrief = {
  id: number;
  display_name: string;
  username?: string;
};

export type MessageRow = {
  id: number;
  session_id: number;
  sender_id: number;
  sender_name: string;
  message_type: string;
  content: string;
  attachment_url?: string | null;
  status?: string;
  revoked_at?: string | null;
  revoked_by?: number | null;
  reply_to_id?: number | null;
  reply_to?: MessageRow | null;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  read_count?: number;
  local_status?: 'SENDING' | 'FAILED';
  created_at: string;
};

export type SessionRow = {
  id: number;
  title: string;
  status: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  unread: number;
  is_pinned?: boolean;
  muted?: boolean;
  participant_count?: number;
  last_message?: MessageRow | null;
  users?: UserBrief[];
  shared_files?: MessageRow[];
};

export type SessionDetail = SessionRow & {
  shared_files: MessageRow[];
};

export async function listChatSessions() {
  const res = await http.get<unknown, { data: SessionRow[] }>('/chat/sessions');
  return res.data;
}

export async function createChatSession(data: { user_ids: number[]; title?: string }) {
  const res = await http.post<unknown, { data: { id: number } }>('/chat/sessions', data);
  return res.data;
}

export async function listChatMessages(sessionId: number, before?: number) {
  const params: Record<string, string | number> = { limit: 50 };
  if (before) params.before = before;
  const res = await http.get<unknown, { data: MessageRow[] }>(
    `/chat/sessions/${sessionId}/messages`,
    { params },
  );
  return res.data;
}

export async function sendChatMessage(
  sessionId: number,
  data: {
    content: string;
    message_type?: string;
    attachment_url?: string;
    reply_to_id?: number;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
  },
) {
  const res = await http.post<unknown, { data: MessageRow }>(
    `/chat/sessions/${sessionId}/messages`,
    data,
  );
  return res.data;
}

export async function markChatRead(sessionId: number) {
  return http.put(`/chat/sessions/${sessionId}/read`);
}

export async function updateChatSession(
  sessionId: number,
  data: { title?: string; status?: string },
) {
  return http.put(`/chat/sessions/${sessionId}`, data);
}

export async function searchChatUsers(keyword: string, limit = 100) {
  const res = await http.get<unknown, { data: UserBrief[] }>('/chat/users', {
    params: { keyword, limit },
  });
  return res.data;
}

export async function getChatSession(sessionId: number) {
  const res = await http.get<unknown, { data: SessionDetail }>(`/chat/sessions/${sessionId}`);
  return res.data;
}

export async function updateChatSessionSettings(
  sessionId: number,
  data: { is_pinned?: boolean; muted?: boolean },
) {
  return http.put(`/chat/sessions/${sessionId}/settings`, data);
}

export async function addChatParticipants(sessionId: number, userIds: number[]) {
  return http.post(`/chat/sessions/${sessionId}/participants`, { user_ids: userIds });
}

export async function removeChatParticipant(sessionId: number, userId: number) {
  return http.delete(`/chat/sessions/${sessionId}/participants/${userId}`);
}

export async function revokeChatMessage(sessionId: number, messageId: number) {
  return http.post(`/chat/sessions/${sessionId}/messages/${messageId}/revoke`);
}
