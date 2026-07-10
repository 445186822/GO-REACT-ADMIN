import {
  BellOutlined,
  BellTwoTone,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  FileOutlined,
  LogoutOutlined,
  MessageOutlined,
  MoreOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Badge,
  Button,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Image,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message as antdMessage,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addChatParticipants,
  createChatSession,
  getChatSession,
  listChatMessages,
  listChatSessions,
  markChatRead,
  removeChatParticipant,
  revokeChatMessage,
  searchChatUsers,
  sendChatMessage,
  updateChatSession,
  updateChatSessionSettings,
  type MessageRow,
  type SessionRow,
  type UserBrief,
} from '../../../api/chat';
import { createFileObjectUrl, downloadFileById, uploadFile } from '../../../api/files';
import { useAuthStore } from '../../../store/authStore';
import {
  buildUserSearchParams,
  formatFileSize,
  getChatSessionTitle,
  getMessageDisplay,
  sortChatSessions,
  toggleSelectedUser,
  visibleChatSessions,
} from '../chatUtils';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import './chat.css';

const { Text, Title } = Typography;

const EMOJIS = ['😊', '😂', '🤣', '😍', '😭', '😅', '👍', '👋', '🤝', '💪', '❤️', '🔥', '🎉', '✅', '⭐', '📋'];

export function ChatPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activeSession, setActiveSession] = useState<SessionRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [input, setInput] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});

  const [userModalMode, setUserModalMode] = useState<'new' | 'add' | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [userResults, setUserResults] = useState<UserBrief[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserBrief[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const activeSessionRef = useRef<SessionRow | null>(null);

  const { connected, onMessage, joinSession, sendWSMessage, sendTyping, sendRead } = useChatWebSocket();

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const filteredSessions = useMemo(
    () => visibleChatSessions(sortChatSessions(sessions), sessionSearch),
    [sessions, sessionSearch],
  );

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await listChatSessions();
      setSessions(sortChatSessions(data));
      return data;
    } catch {
      antdMessage.error('会话加载失败');
      return [];
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const refreshActiveSession = useCallback(async (sessionId: number) => {
    try {
      const detail = await getChatSession(sessionId);
      setActiveSession(detail);
      setEditingTitle(detail.title);
      setSessions((prev) => sortChatSessions(prev.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))));
      return detail;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    onMessage((event) => {
      const active = activeSessionRef.current;
      if (event.type === 'message') {
        const incoming = event.message as MessageRow;
        setMessages((prev) => {
          const withoutOptimistic = prev.filter(
            (item) =>
              !(
                item.id < 0 &&
                item.sender_id === incoming.sender_id &&
                item.content === incoming.content &&
                item.message_type === incoming.message_type
              ),
          );
          if (withoutOptimistic.some((item) => item.id === incoming.id)) return withoutOptimistic;
          return [...withoutOptimistic, incoming];
        });
        setSessions((prev) =>
          sortChatSessions(
            prev.map((item) =>
              item.id === incoming.session_id
                ? {
                    ...item,
                    last_message: incoming,
                    updated_at: incoming.created_at,
                    unread:
                      active?.id === incoming.session_id || incoming.sender_id === currentUser?.id
                        ? item.unread
                        : item.unread + 1,
                  }
                : item,
            ),
          ),
        );
        if (active?.id === incoming.session_id) {
          sendRead(incoming.session_id, incoming.id);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
        }
      }
      if (event.type === 'message_revoked') {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === event.message_id
              ? { ...item, status: 'REVOKED', revoked_at: new Date().toISOString(), revoked_by: event.user_id }
              : item,
          ),
        );
        void loadSessions();
      }
      if (event.type === 'session_new' || event.type === 'session_updated' || event.type === 'participants_updated') {
        void loadSessions();
        if (active?.id === event.session_id) void refreshActiveSession(event.session_id);
      }
      if (event.type === 'typing' && active?.id === event.session_id && event.user_id !== currentUser?.id) {
        setTypingUsers((prev) => ({ ...prev, [event.user_id]: event.name }));
        if (typingTimers.current[event.user_id]) clearTimeout(typingTimers.current[event.user_id]);
        typingTimers.current[event.user_id] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[event.user_id];
            return next;
          });
        }, 2500);
      }
      if (event.type === 'read_receipt' && active?.id === event.session_id) {
        setMessages((prev) =>
          prev.map((item) =>
            item.id <= event.message_id && item.sender_id === currentUser?.id
              ? { ...item, read_count: Math.max(item.read_count ?? 0, 1) }
              : item,
          ),
        );
      }
    });
  }, [currentUser?.id, loadSessions, onMessage, refreshActiveSession, sendRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function selectSession(session: SessionRow) {
    if (activeSession?.id === session.id) return;
    setActiveSession(session);
    setEditingTitle(session.title);
    setMessages([]);
    setHasMore(true);
    setLoadingMessages(true);
    joinSession(session.id);
    try {
      const [detail, rows] = await Promise.all([getChatSession(session.id), listChatMessages(session.id)]);
      setActiveSession(detail);
      setEditingTitle(detail.title);
      setMessages(rows);
      setHasMore(rows.length >= 50);
      const latest = rows[rows.length - 1];
      await markChatRead(session.id);
      if (latest) sendRead(session.id, latest.id);
      setSessions((prev) => sortChatSessions(prev.map((item) => (item.id === session.id ? { ...item, ...detail, unread: 0 } : item))));
    } catch {
      antdMessage.error('消息加载失败');
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadMoreMessages() {
    if (!activeSession || loadingMore || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const older = await listChatMessages(activeSession.id, oldest.id);
      setHasMore(older.length >= 50);
      setMessages((prev) => [...older, ...prev]);
    } catch {
      antdMessage.error('历史消息加载失败');
    } finally {
      setLoadingMore(false);
    }
  }

  function handleMessagesScroll() {
    const el = messagesRef.current;
    if (el && el.scrollTop < 60) void loadMoreMessages();
  }

  async function sendMessage(payload: {
    content: string;
    message_type?: string;
    attachment_url?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
  }) {
    if (!activeSession || sending) return;
    const content = payload.content.trim();
    if (!content && !payload.attachment_url) return;

    const messageType = payload.message_type ?? 'TEXT';
    const optimistic: MessageRow = {
      id: -Date.now(),
      session_id: activeSession.id,
      sender_id: currentUser?.id ?? 0,
      sender_name: currentUser?.display_name ?? currentUser?.username ?? '',
      message_type: messageType,
      content,
      attachment_url: payload.attachment_url,
      file_name: payload.file_name,
      file_size: payload.file_size,
      mime_type: payload.mime_type,
      status: 'SENT',
      local_status: 'SENDING',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setSending(true);
    setInput('');

    const sentByWs = connected && sendWSMessage(activeSession.id, { ...payload, content, message_type: messageType });
    if (!sentByWs) {
      try {
        const saved = await sendChatMessage(activeSession.id, { ...payload, content, message_type: messageType });
        setMessages((prev) => prev.map((item) => (item.id === optimistic.id ? saved : item)));
      } catch {
        setMessages((prev) => prev.map((item) => (item.id === optimistic.id ? { ...item, local_status: 'FAILED' } : item)));
        antdMessage.error('发送失败');
      }
    }
    setSending(false);
  }

  async function handleSend() {
    await sendMessage({ content: input, message_type: 'TEXT' });
  }

  async function retryMessage(msg: MessageRow) {
    setMessages((prev) => prev.filter((item) => item.id !== msg.id));
    await sendMessage({
      content: msg.content,
      message_type: msg.message_type,
      attachment_url: msg.attachment_url ?? undefined,
      file_name: msg.file_name,
      file_size: msg.file_size,
      mime_type: msg.mime_type,
    });
  }

  async function handleFilePicked(file: File) {
    if (!activeSession) return;
    try {
      const uploaded = await uploadFile(file);
      const isImage = file.type.startsWith('image/');
      await sendMessage({
        content: file.name,
        message_type: isImage ? 'IMAGE' : 'FILE',
        attachment_url: String(uploaded.id),
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      });
    } catch {
      antdMessage.error('附件上传失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function loadUsers(keyword: string, mode = userModalMode) {
    setUserSearch(keyword);
    setUserLoading(true);
    try {
      const params = buildUserSearchParams(keyword);
      const users = await searchChatUsers(params.keyword, params.limit);
      const existing = mode === 'add' ? new Set(activeSession?.users?.map((user) => user.id)) : new Set<number>();
      setUserResults(users.filter((user) => !existing.has(user.id)));
    } catch {
      setUserResults([]);
      antdMessage.error('用户加载失败');
    } finally {
      setUserLoading(false);
    }
  }

  function openUserModal(mode: 'new' | 'add') {
    setUserModalMode(mode);
    setSelectedUsers([]);
    void loadUsers('', mode);
  }

  async function handleUserModalOk() {
    if (selectedUsers.length === 0) return;
    try {
      if (userModalMode === 'new') {
        const created = await createChatSession({ user_ids: selectedUsers.map((user) => user.id) });
        const updated = await loadSessions();
        const found = updated.find((item) => item.id === created.id);
        if (found) await selectSession(found);
      } else if (userModalMode === 'add' && activeSession) {
        await addChatParticipants(activeSession.id, selectedUsers.map((user) => user.id));
        await refreshActiveSession(activeSession.id);
        await loadSessions();
      }
      closeUserModal();
    } catch {
      antdMessage.error(userModalMode === 'new' ? '新建会话失败' : '添加成员失败');
    }
  }

  function closeUserModal() {
    setUserModalMode(null);
    setUserSearch('');
    setUserResults([]);
    setSelectedUsers([]);
  }

  async function saveTitle() {
    if (!activeSession) return;
    try {
      await updateChatSession(activeSession.id, { title: editingTitle });
      await refreshActiveSession(activeSession.id);
      await loadSessions();
      antdMessage.success('标题已更新');
    } catch {
      antdMessage.error('标题更新失败');
    }
  }

  async function updateSettings(data: { is_pinned?: boolean; muted?: boolean }) {
    if (!activeSession) return;
    try {
      await updateChatSessionSettings(activeSession.id, data);
      const next = { ...activeSession, ...data };
      setActiveSession(next);
      setSessions((prev) => sortChatSessions(prev.map((item) => (item.id === next.id ? { ...item, ...data } : item))));
    } catch {
      antdMessage.error('设置更新失败');
    }
  }

  async function leaveSession() {
    if (!activeSession || !currentUser) return;
    try {
      await removeChatParticipant(activeSession.id, currentUser.id);
      setActiveSession(null);
      setMessages([]);
      setDetailOpen(false);
      await loadSessions();
    } catch {
      antdMessage.error('退出会话失败');
    }
  }

  async function removeMember(user: UserBrief) {
    if (!activeSession) return;
    try {
      await removeChatParticipant(activeSession.id, user.id);
      await refreshActiveSession(activeSession.id);
      await loadSessions();
    } catch {
      antdMessage.error('移除成员失败');
    }
  }

  async function handleRevoke(msg: MessageRow) {
    if (!activeSession) return;
    try {
      await revokeChatMessage(activeSession.id, msg.id);
      setMessages((prev) => prev.map((item) => (item.id === msg.id ? { ...item, status: 'REVOKED' } : item)));
    } catch {
      antdMessage.error('撤回失败，可能已超过可撤回时间');
    }
  }

  function getSessionTitle(session: SessionRow): string {
    return getChatSessionTitle(session, currentUser?.id);
  }

  function typingText() {
    const names = Object.values(typingUsers);
    if (names.length === 0) return '';
    return `${names.join('、')} 正在输入...`;
  }

  function renderMessage(msg: MessageRow) {
    const mine = msg.sender_id === currentUser?.id;
    const display = getMessageDisplay(msg);
    const canRevoke = mine && msg.id > 0 && display.kind !== 'revoked' && display.kind !== 'system';

    if (display.kind === 'system' || display.kind === 'revoked') {
      return (
        <div className="chat-system-msg">
          <span>{display.text}</span>
        </div>
      );
    }

    return (
      <div className={`chat-msg ${mine ? 'chat-msg-mine' : 'chat-msg-other'}`}>
        {!mine && (
          <Avatar size={36} style={{ background: '#1677ff' }}>
            {msg.sender_name?.[0] || '?'}
          </Avatar>
        )}
        <div className="chat-bubble-wrap">
          {!mine && <div className="chat-sender-label">{msg.sender_name}</div>}
          <div className={`chat-bubble ${display.kind === 'failed' ? 'chat-bubble-failed' : ''}`}>
            {display.kind === 'image' && <AuthenticatedImage fileID={attachmentFileID(display.url)} alt={display.text || '图片'} />}
            {display.kind === 'file' && (
              <button className="chat-file-link" type="button" onClick={() => void downloadFileById(attachmentFileID(display.url), display.fileName)}>
                <FileOutlined />
                <span>{display.fileName}</span>
                <Text type="secondary">{formatFileSize(display.fileSize)}</Text>
              </button>
            )}
            {(display.kind === 'text' || display.kind === 'failed') && display.text}
          </div>
          <div className="chat-message-meta">
            {msg.local_status === 'SENDING' && <Text type="secondary">发送中</Text>}
            {msg.local_status === 'FAILED' && <Button type="link" size="small" onClick={() => void retryMessage(msg)}>重试</Button>}
            {mine && msg.id > 0 && <Text type="secondary">{(msg.read_count ?? 0) > 0 ? '已读' : '已送达'}</Text>}
            {canRevoke && (
              <Dropdown
                trigger={['click']}
                menu={{ items: [{ key: 'revoke', label: '撤回消息' }], onClick: () => void handleRevoke(msg) }}
              >
                <Button type="text" size="small" icon={<MoreOutlined />} />
              </Dropdown>
            )}
          </div>
        </div>
        {mine && <Avatar size={36} style={{ background: '#52c41a' }} icon={<UserOutlined />} />}
      </div>
    );
  }

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <Space>
            <MessageOutlined />
            <Text strong>消息</Text>
            <span className={`chat-status-dot ${connected ? 'chat-status-online' : 'chat-status-offline'}`} />
          </Space>
          <Space size={4}>
            <Tooltip title="刷新"><Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void loadSessions()} /></Tooltip>
            <Tooltip title="新建会话"><Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openUserModal('new')} /></Tooltip>
          </Space>
        </div>
        <div className="chat-session-search">
          <Input prefix={<SearchOutlined />} allowClear value={sessionSearch} onChange={(event) => setSessionSearch(event.target.value)} placeholder="搜索会话" />
        </div>
        <div className="chat-session-list">
          {loadingSessions && <div className="chat-loading-more"><Spin /></div>}
          {!loadingSessions && filteredSessions.length === 0 && (
            <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserModal('new')}>新建会话</Button>
            </Empty>
          )}
          {filteredSessions.map((session) => {
            const active = activeSession?.id === session.id;
            const title = getSessionTitle(session);
            const last = session.last_message;
            return (
              <div key={session.id} className={`chat-session-item ${active ? 'chat-session-active' : ''}`} onClick={() => void selectSession(session)} role="button" tabIndex={0}>
                <Badge dot={session.is_pinned} offset={[-2, 38]}>
                  <Avatar size={44} icon={(session.participant_count ?? session.users?.length ?? 0) > 2 ? <TeamOutlined /> : undefined} style={{ background: '#1677ff' }}>
                    {(session.participant_count ?? session.users?.length ?? 0) > 2 ? null : title[0]}
                  </Avatar>
                </Badge>
                <div className="chat-session-body">
                  <div className="chat-session-top">
                    <Text strong className="chat-session-name">{session.is_pinned && <PushpinFilled className="chat-inline-icon" />}{title}</Text>
                    <Text type="secondary" className="chat-session-time">{last ? dayjs(last.created_at).format('HH:mm') : ''}</Text>
                  </div>
                  <div className="chat-session-bottom">
                    <Text type="secondary" className="chat-session-msg" ellipsis>{last?.content || '暂无消息'}</Text>
                    {session.muted ? <BellTwoTone twoToneColor="#98a2b3" /> : session.unread > 0 && <Badge count={session.unread} size="small" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="chat-main">
        {!activeSession ? (
          <div className="chat-empty">
            <Empty description="选择一个会话开始聊天" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserModal('new')}>新建会话</Button>
            </Empty>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <div className="chat-header-info">
                <Title level={5}>{getSessionTitle(activeSession)}</Title>
                <Tag>{activeSession.participant_count || activeSession.users?.length || 1} 人</Tag>
              </div>
              <Space>
                <Tooltip title={activeSession.is_pinned ? '取消置顶' : '置顶'}>
                  <Button type="text" icon={activeSession.is_pinned ? <PushpinFilled /> : <PushpinOutlined />} onClick={() => void updateSettings({ is_pinned: !activeSession.is_pinned })} />
                </Tooltip>
                <Tooltip title={activeSession.muted ? '取消免打扰' : '免打扰'}>
                  <Button type="text" icon={<BellOutlined />} onClick={() => void updateSettings({ muted: !activeSession.muted })} />
                </Tooltip>
                <Button icon={<TeamOutlined />} onClick={() => setDetailOpen(true)}>详情</Button>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [{ key: 'close', icon: <DeleteOutlined />, label: '关闭会话', danger: true }],
                    onClick: async () => {
                      await updateChatSession(activeSession.id, { status: 'CLOSED' });
                      setActiveSession(null);
                      setMessages([]);
                      await loadSessions();
                    },
                  }}
                >
                  <Button type="text" icon={<EllipsisOutlined />} />
                </Dropdown>
              </Space>
            </header>
            <section className="chat-messages" ref={messagesRef} onScroll={handleMessagesScroll}>
              {loadingMore && <div className="chat-loading-more"><Spin size="small" /></div>}
              {loadingMessages ? <div className="chat-loading-more"><Spin /></div> : messages.map((msg) => <div key={msg.id}>{renderMessage(msg)}</div>)}
              {!loadingMessages && messages.length === 0 && <div className="chat-empty-msg"><Text type="secondary">暂无消息</Text></div>}
              {typingText() && <div className="chat-typing">{typingText()}</div>}
              <div ref={bottomRef} />
            </section>
            <footer className="chat-input-area">
              <div className="chat-toolbar">
                <Space>
                  <Button type="text" icon={<PictureOutlined />} onClick={() => setShowEmoji((value) => !value)} />
                  <Button type="text" icon={<PaperClipOutlined />} onClick={() => fileInputRef.current?.click()} />
                  <input ref={fileInputRef} type="file" hidden onChange={(event) => event.target.files?.[0] && void handleFilePicked(event.target.files[0])} />
                </Space>
                <Text type="secondary">Enter 发送 · Shift+Enter 换行</Text>
              </div>
              {showEmoji && (
                <div className="chat-emoji-panel">
                  {EMOJIS.map((emoji) => <button key={emoji} className="chat-emoji-item" onClick={() => { setInput((prev) => prev + emoji); setShowEmoji(false); }}>{emoji}</button>)}
                </div>
              )}
              <Input.TextArea
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  if (activeSession) sendTyping(activeSession.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="输入消息..."
                autoSize={{ minRows: 2, maxRows: 4 }}
                disabled={sending}
                className="chat-textarea"
              />
              <div className="chat-input-footer">
                <div />
                <Button type="primary" icon={<SendOutlined />} disabled={!input.trim() || sending} loading={sending} onClick={() => void handleSend()}>发送</Button>
              </div>
            </footer>
          </>
        )}
      </main>

      <Drawer title="会话详情" open={detailOpen} onClose={() => setDetailOpen(false)} width={360}>
        {activeSession && (
          <div className="chat-detail">
            <Space.Compact style={{ width: '100%' }}>
              <Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} prefix={<EditOutlined />} />
              <Button onClick={() => void saveTitle()}>保存</Button>
            </Space.Compact>
            <Divider />
            <div className="chat-detail-row"><Text>置顶</Text><Switch checked={activeSession.is_pinned} onChange={(checked) => void updateSettings({ is_pinned: checked })} /></div>
            <div className="chat-detail-row"><Text>免打扰</Text><Switch checked={activeSession.muted} onChange={(checked) => void updateSettings({ muted: checked })} /></div>
            <Divider />
            <div className="chat-detail-heading">
              <Text strong>成员</Text>
              <Button size="small" icon={<UserAddOutlined />} onClick={() => openUserModal('add')}>添加</Button>
            </div>
            <List
              dataSource={activeSession.users ?? []}
              renderItem={(user) => (
                <List.Item
                  actions={[
                    user.id !== currentUser?.id && activeSession.created_by === currentUser?.id ? (
                      <Popconfirm key="remove" title="移除成员？" onConfirm={() => void removeMember(user)}>
                        <Button size="small" type="link" danger>移除</Button>
                      </Popconfirm>
                    ) : null,
                  ]}
                >
                  <List.Item.Meta avatar={<Avatar>{user.display_name[0]}</Avatar>} title={user.display_name} description={user.username} />
                </List.Item>
              )}
            />
            <Button danger block icon={<LogoutOutlined />} onClick={() => void leaveSession()}>退出会话</Button>
            <Divider />
            <Text strong>共享文件</Text>
            <List
              dataSource={activeSession.shared_files ?? []}
              locale={{ emptyText: '暂无共享文件' }}
              renderItem={(file) => (
                <List.Item>
                  <Button type="link" onClick={() => file.attachment_url && void downloadFileById(attachmentFileID(file.attachment_url), file.file_name || file.content)}>
                    {file.message_type === 'IMAGE' ? <PictureOutlined /> : <FileOutlined />} {file.file_name || file.content}
                  </Button>
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>

      <Modal
        title={userModalMode === 'add' ? '添加成员' : '新建会话'}
        open={Boolean(userModalMode)}
        onCancel={closeUserModal}
        onOk={() => void handleUserModalOk()}
        okText={userModalMode === 'add' ? '添加' : '开始聊天'}
        okButtonProps={{ disabled: selectedUsers.length === 0 }}
        width={520}
      >
        <Input
          value={userSearch}
          onChange={(event) => void loadUsers(event.target.value)}
          placeholder="搜索用户；不输入时显示所有其它用户"
          prefix={<SearchOutlined />}
          allowClear
        />
        <div className="chat-user-search-results">
          {userLoading ? (
            <div className="chat-loading-more"><Spin /></div>
          ) : userResults.length === 0 ? (
            <Empty description="暂无用户" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            userResults.map((user) => {
              const selected = selectedUsers.some((item) => item.id === user.id);
              return (
                <div key={user.id} className={`chat-user-item ${selected ? 'chat-user-selected' : ''}`} onClick={() => setSelectedUsers((prev) => toggleSelectedUser(prev, user))} role="button" tabIndex={0}>
                  <Avatar>{user.display_name[0]}</Avatar>
                  <div className="chat-user-main">
                    <Text>{user.display_name}</Text>
                    <Text type="secondary">{user.username}</Text>
                  </div>
                  {selected && <Tag color="blue">已选</Tag>}
                </div>
              );
            })
          )}
        </div>
        {selectedUsers.length > 0 && (
          <div className="chat-selected-users">
            {selectedUsers.map((user) => <Tag key={user.id} closable onClose={() => setSelectedUsers((prev) => toggleSelectedUser(prev, user))}>{user.display_name}</Tag>)}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ChatPage;

function attachmentFileID(value: string): number {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = value.match(/\/files\/(\d+)\/download/);
  return match ? Number(match[1]) : 0;
}

function AuthenticatedImage({ fileID, alt }: { fileID: number; alt: string }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = '';
    setUrl('');
    setFailed(false);
    if (!fileID) {
      setFailed(true);
      return undefined;
    }
    void createFileObjectUrl(fileID)
      .then((objectUrl) => {
        revoked = objectUrl;
        setUrl(objectUrl);
      })
      .catch(() => {
        setFailed(true);
      });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileID]);

  if (failed) return <Text type="secondary">图片已失效</Text>;
  if (!url) return <Spin size="small" />;
  return <Image src={url} alt={alt} className="chat-bubble-image" />;
}
