import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import type { MessageRow } from '../../../api/chat';

type WSMessage =
  | { type: 'message'; message: MessageRow }
  | { type: 'session_new'; session_id: number }
  | { type: 'session_updated'; session_id: number }
  | { type: 'participants_updated'; session_id: number }
  | { type: 'message_revoked'; session_id: number; message_id: number; user_id: number }
  | { type: 'read_receipt'; session_id: number; user_id: number; message_id: number }
  | { type: 'typing'; user_id: number; name: string; session_id: number }
  | { type: 'error'; message?: string };

type MessageHandler = (msg: WSMessage) => void;

const WS_MAX_RETRIES = 10;
let ws: WebSocket | null = null;
let retryCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let handlerRefs = new Set<MessageHandler>();
let activeToken: string | null = null;
let wsConnected = false;

function notifyHandlers(msg: WSMessage) {
  handlerRefs.forEach((fn) => {
    try {
      fn(msg);
    } catch {
      // ignore
    }
  });
}

function connect(token: string) {
  if (ws && ws.readyState === WebSocket.OPEN && activeToken === token) {
    return;
  }

  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.close();
    ws = null;
  }

  activeToken = token;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/api/v1/chat/ws?token=${encodeURIComponent(token)}`;

  const newWs = new WebSocket(url);

  const connectTimeout = setTimeout(() => {
    if (newWs.readyState === WebSocket.CONNECTING) {
      newWs.close();
    }
  }, 10000);

  newWs.onopen = () => {
    clearTimeout(connectTimeout);
    retryCount = 0;
    wsConnected = true;
  };

  newWs.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WSMessage;
      notifyHandlers(data);
    } catch {
      // ignore parse errors
    }
  };

  newWs.onclose = () => {
    clearTimeout(connectTimeout);
    wsConnected = false;
    if (ws === newWs) {
      ws = null;
      scheduleReconnect();
    }
  };

  newWs.onerror = () => {
    wsConnected = false;
  };

  ws = newWs;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (!activeToken) return;
  if (handlerRefs.size === 0) return;

  const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
  retryCount++;

  if (retryCount > WS_MAX_RETRIES) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (handlerRefs.size > 0 && activeToken) {
      connect(activeToken);
    }
  }, delay);
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    ws.close();
    ws = null;
  }
  wsConnected = false;
  activeToken = null;
  retryCount = 0;
}

/**
 * Send a message through WebSocket
 */
function sendRaw(data: Record<string, unknown>) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

/**
 * Shared WebSocket hook for real-time chat messaging.
 */
export function useChatWebSocket() {
  const token = useAuthStore((state) => state.accessToken);
  const [connected, setConnected] = useState(wsConnected);
  const handlerRef = useRef<MessageHandler | null>(null);

  useEffect(() => {
    if (!token) {
      disconnect();
      setConnected(false);
      return;
    }

    const handler: MessageHandler = (data) => {
      if (handlerRef.current) handlerRef.current(data);
    };

    handlerRefs.add(handler);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connect(token);
    }

    // Poll connected state
    const interval = setInterval(() => {
      setConnected(wsConnected);
    }, 1000);

    return () => {
      handlerRefs.delete(handler);
      clearInterval(interval);
      if (handlerRefs.size === 0) {
        disconnect();
      }
    };
  }, [token]);

  const onMessage = useCallback((fn: MessageHandler) => {
    handlerRef.current = fn;
  }, []);

  const joinSession = useCallback((sessionId: number) => {
    sendRaw({ type: 'join', session_id: sessionId });
  }, []);

  const leaveSession = useCallback((sessionId: number) => {
    sendRaw({ type: 'leave', session_id: sessionId });
  }, []);

  const sendWSMessage = useCallback(
    (
      sessionId: number,
      data: {
        content: string;
        message_type?: string;
        attachment_url?: string;
        file_name?: string;
        file_size?: number;
        mime_type?: string;
        reply_to_id?: number;
      },
    ) => {
      if (sendRaw({ type: 'msg', session_id: sessionId, ...data })) {
        return true;
      }
      return false;
    },
    [],
  );

  const sendTyping = useCallback((sessionId: number) => {
    sendRaw({ type: 'typing', session_id: sessionId });
  }, []);

  const sendRead = useCallback((sessionId: number, messageId: number) => {
    sendRaw({ type: 'read', session_id: sessionId, message_id: messageId });
  }, []);

  return {
    connected,
    onMessage,
    joinSession,
    leaveSession,
    sendWSMessage,
    sendTyping,
    sendRead,
  };
}
