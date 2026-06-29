import { describe, expect, it } from 'vitest';
import type { MessageRow, SessionRow, UserBrief } from '../../api/chat';
import {
  CHAT_USER_SEARCH_LIMIT,
  buildUserSearchParams,
  getChatSessionTitle,
  getMessageDisplay,
  sortChatSessions,
  toggleSelectedUser,
  visibleChatSessions,
} from './chatUtils';

function session(overrides: Partial<SessionRow>): SessionRow {
  return {
    id: 1,
    title: '',
    status: 'ACTIVE',
    created_by: 1,
    created_at: '2026-06-29T00:00:00Z',
    updated_at: '2026-06-29T00:00:00Z',
    unread: 0,
    is_pinned: false,
    muted: false,
    participant_count: 2,
    users: [],
    ...overrides,
  };
}

function message(overrides: Partial<MessageRow>): MessageRow {
  return {
    id: 1,
    session_id: 1,
    sender_id: 1,
    sender_name: 'Admin',
    message_type: 'TEXT',
    content: 'hello',
    status: 'SENT',
    created_at: '2026-06-29T00:00:00Z',
    ...overrides,
  };
}

describe('chatUtils', () => {
  it('sorts pinned sessions first and then by updated time', () => {
    const result = sortChatSessions([
      session({ id: 1, updated_at: '2026-06-29T08:00:00Z' }),
      session({ id: 2, is_pinned: true, updated_at: '2026-06-28T08:00:00Z' }),
      session({ id: 3, updated_at: '2026-06-30T08:00:00Z' }),
    ]);

    expect(result.map((item) => item.id)).toEqual([2, 3, 1]);
  });

  it('filters sessions by title, participant names, and last message content', () => {
    const sessions = [
      session({ id: 1, title: '财务群', users: [{ id: 2, display_name: '李雷' }] }),
      session({
        id: 2,
        users: [{ id: 3, display_name: '韩梅梅' }],
        last_message: message({ content: '合同已经发出' }),
      }),
      session({ id: 3, title: '研发同步', last_message: message({ content: '明天上线' }) }),
    ];

    expect(visibleChatSessions(sessions, '合同').map((item) => item.id)).toEqual([2]);
    expect(visibleChatSessions(sessions, '韩梅梅').map((item) => item.id)).toEqual([2]);
    expect(visibleChatSessions(sessions, '财务').map((item) => item.id)).toEqual([1]);
  });

  it('uses the other participant name for direct sessions even when stored title is current user name', () => {
    const direct = session({
      title: '系统管理员',
      participant_count: 2,
      users: [
        { id: 1, display_name: '系统管理员' },
        { id: 2, display_name: 'HR经理' },
      ],
    });

    expect(getChatSessionTitle(direct, 1)).toBe('HR经理');
    expect(getChatSessionTitle(direct, 2)).toBe('系统管理员');
  });

  it('keeps the stored title for group sessions', () => {
    expect(
      getChatSessionTitle(
        session({
          title: '项目群',
          participant_count: 3,
          users: [
            { id: 1, display_name: '系统管理员' },
            { id: 2, display_name: 'HR经理' },
            { id: 3, display_name: '财务经理' },
          ],
        }),
        1,
      ),
    ).toBe('项目群');
  });

  it('toggles selected users without duplicates', () => {
    const alice: UserBrief = { id: 2, display_name: 'Alice' };
    const bob: UserBrief = { id: 3, display_name: 'Bob' };

    expect(toggleSelectedUser([], alice)).toEqual([alice]);
    expect(toggleSelectedUser([alice], alice)).toEqual([]);
    expect(toggleSelectedUser([alice], bob)).toEqual([alice, bob]);
    expect(toggleSelectedUser([alice, alice], bob)).toEqual([alice, bob]);
  });

  it('derives display state for revoked, file, image, and failed messages', () => {
    expect(getMessageDisplay(message({ status: 'REVOKED', revoked_at: '2026-06-29T00:01:00Z' })).kind).toBe('revoked');
    expect(getMessageDisplay(message({ message_type: 'IMAGE', attachment_url: '/a.png' })).kind).toBe('image');
    expect(getMessageDisplay(message({ message_type: 'FILE', file_name: '合同.pdf', attachment_url: '/f.pdf' })).kind).toBe('file');
    expect(getMessageDisplay(message({ local_status: 'FAILED' })).kind).toBe('failed');
  });

  it('builds empty keyword user-search params instead of suppressing the request', () => {
    expect(CHAT_USER_SEARCH_LIMIT).toBe(100);
    expect(buildUserSearchParams('')).toEqual({ keyword: '', limit: 100 });
    expect(buildUserSearchParams('  李雷  ')).toEqual({ keyword: '李雷', limit: 100 });
  });
});
