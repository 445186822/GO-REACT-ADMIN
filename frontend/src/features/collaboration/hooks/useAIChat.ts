import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';

const STORAGE_KEY_PREFIX = 'ai_conversations_';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface StoredConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getStorageKey(): string {
  const user = useAuthStore.getState().user;
  const userId = user?.id ?? 'anonymous';
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function loadAll(): { conversations: StoredConversation[]; activeId: string } {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.conversations)) {
        return { conversations: data.conversations, activeId: data.activeId ?? '' };
      }
    }
  } catch {
    // ignore parse errors
  }
  return { conversations: [], activeId: '' };
}

function saveAll(conversations: StoredConversation[], activeId: string): void {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify({ conversations, activeId }));
  } catch {
    // ignore quota errors
  }
}

const welcomeMessage: Message = {
  role: 'assistant',
  content:
    '你好，我是企业平台的 AI 智能助手。\n\n我可以帮助你解答系统使用问题、提供数据分析建议、协助文档编写，并给出工作流和审批配置建议。',
};

function createNewConversation(): StoredConversation {
  return {
    id: generateId(),
    title: '新对话',
    messages: [{ ...welcomeMessage }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Truncate the first user message to make a conversation title.
 */
function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  if (!firstUser) return '新对话';
  const raw = firstUser.content.replace(/\n/g, ' ').trim();
  return raw.length > 28 ? raw.slice(0, 28) + '...' : raw;
}

export function useAIChat() {
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const conversationsRef = useRef<StoredConversation[]>([]);
  const activeIdRef = useRef<string>('');

  // Keep refs in sync with state
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Initialize from localStorage
  useEffect(() => {
    const saved = loadAll();
    let convs = saved.conversations;
    let active = saved.activeId;

    if (convs.length === 0) {
      const newConv = createNewConversation();
      convs = [newConv];
      active = newConv.id;
    } else if (!convs.some((c) => c.id === active)) {
      active = convs[0].id;
    }

    setConversations(convs);
    setActiveId(active);

    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (conversations.length > 0 && activeId) {
      saveAll(conversations, activeId);
    }
  }, [conversations, activeId]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];

  /** Send a user message and stream the assistant reply via SSE. */
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loadingRef.current) return;

    const convId = activeIdRef.current;
    if (!convId) return;

    // Abort any in-flight request
    abortRef.current?.abort();

    const userMsg: Message = { role: 'user', content: trimmed };

    // Build API payload from current messages + new user message
    const currentConv = conversationsRef.current.find((c) => c.id === convId);
    const historyMessages = currentConv ? [...currentConv.messages, userMsg] : [userMsg];
    const apiMessages = historyMessages.map((m) => ({ role: m.role, content: m.content }));

    // Add user message + empty assistant placeholder to UI immediately
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          title: deriveTitle([...c.messages, userMsg]),
          messages: [...c.messages, userMsg, { role: 'assistant', content: '' }],
          updatedAt: Date.now(),
        };
      }),
    );

    setLoading(true);
    loadingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    const token = useAuthStore.getState().accessToken;
    let accumulated = '';

    try {
      const response = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith('data: ')) continue;

          const data = trimmedLine.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.delta != null) {
              accumulated += parsed.delta;
              // Use functional updater for latest state
              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== convId) return c;
                  const msgs = [...c.messages];
                  msgs[msgs.length - 1] = { role: 'assistant', content: accumulated };
                  return { ...c, messages: msgs, updatedAt: Date.now() };
                }),
              );
            }
          } catch {
            // skip malformed JSON inside data payload
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = {
            role: 'assistant',
            content: accumulated || 'AI 服务暂时不可用，请检查后端服务和 AI 配置后再试。',
          };
          return { ...c, messages: msgs, updatedAt: Date.now() };
        }),
      );
    } finally {
      setLoading(false);
      loadingRef.current = false;
      abortRef.current = null;
    }
  }, []);

  /** Start a fresh conversation and save the current one. */
  const newConversation = useCallback(() => {
    const newConv = createNewConversation();
    setConversations((prev) => [...prev, newConv]);
    setActiveId(newConv.id);
  }, []);

  /** Switch to an existing conversation by id. */
  const switchConversation = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  /** Delete a conversation entirely. */
  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const newConv = createNewConversation();
        setActiveId(newConv.id);
        return [newConv];
      }
      if (activeIdRef.current === id) {
        setActiveId(filtered[0].id);
      }
      return filtered;
    });
  }, []);

  /** Clear messages in the active conversation (reset to welcome). */
  const clearMessages = useCallback(() => {
    const convId = activeIdRef.current;
    if (!convId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== convId) return c;
        return {
          ...c,
          title: '新对话',
          messages: [{ ...welcomeMessage }],
          updatedAt: Date.now(),
        };
      }),
    );
  }, []);

  return {
    messages,
    loading,
    conversations,
    activeId,
    activeConversation,
    sendMessage,
    newConversation,
    switchConversation,
    deleteConversation,
    clearMessages,
  };
}
