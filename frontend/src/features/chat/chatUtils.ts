import type { MessageRow, SessionRow, UserBrief } from '../../api/chat';

export const CHAT_USER_SEARCH_LIMIT = 100;

export type MessageDisplay =
  | { kind: 'revoked'; text: string }
  | { kind: 'failed'; text: string }
  | { kind: 'image'; url: string; text: string }
  | { kind: 'file'; url: string; fileName: string; fileSize: number; mimeType: string }
  | { kind: 'system'; text: string }
  | { kind: 'text'; text: string };

export function buildUserSearchParams(keyword: string) {
  return {
    keyword: keyword.trim(),
    limit: CHAT_USER_SEARCH_LIMIT,
  };
}

export function sortChatSessions(sessions: SessionRow[]): SessionRow[] {
  return [...sessions].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) {
      return a.is_pinned ? -1 : 1;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export function visibleChatSessions(sessions: SessionRow[], keyword: string): SessionRow[] {
  const normalized = keyword.trim().toLowerCase();
  const sorted = sortChatSessions(sessions);
  if (!normalized) return sorted;

  return sorted.filter((session) => {
    const names = session.users?.map((user) => user.display_name).join(' ') ?? '';
    const haystack = [
      session.title,
      names,
      session.last_message?.content,
      session.last_message?.sender_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function getChatSessionTitle(session: SessionRow, currentUserId?: number): string {
  const users = session.users ?? [];
  const participantCount = session.participant_count ?? users.length;
  const isDirectSession = participantCount <= 2 && users.length > 0;

  if (isDirectSession) {
    const other = users.find((user) => user.id !== currentUserId);
    if (other?.display_name) return other.display_name;
    const first = users[0];
    if (first?.display_name) return first.display_name;
  }

  if (session.title?.trim()) return session.title.trim();

  const others = users.filter((user) => user.id !== currentUserId);
  const names = (others.length > 0 ? others : users).map((user) => user.display_name).filter(Boolean);
  return names.join('、') || '会话';
}

export function toggleSelectedUser(selected: UserBrief[], user: UserBrief): UserBrief[] {
  const deduped = selected.filter(
    (candidate, index, arr) => arr.findIndex((item) => item.id === candidate.id) === index,
  );
  if (deduped.some((candidate) => candidate.id === user.id)) {
    return deduped.filter((candidate) => candidate.id !== user.id);
  }
  return [...deduped, user];
}

export function getMessageDisplay(message: MessageRow): MessageDisplay {
  if (message.local_status === 'FAILED') {
    return { kind: 'failed', text: message.content || '发送失败' };
  }
  if (message.status === 'REVOKED' || message.revoked_at) {
    return { kind: 'revoked', text: '消息已撤回' };
  }
  if (message.message_type === 'SYSTEM' || message.sender_id === 0) {
    return { kind: 'system', text: message.content };
  }
  if (message.message_type === 'IMAGE' && message.attachment_url) {
    return { kind: 'image', url: message.attachment_url, text: message.content };
  }
  if (message.message_type === 'FILE' && message.attachment_url) {
    return {
      kind: 'file',
      url: message.attachment_url,
      fileName: message.file_name || message.content || '附件',
      fileSize: message.file_size ?? 0,
      mimeType: message.mime_type || 'application/octet-stream',
    };
  }
  return { kind: 'text', text: message.content };
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
