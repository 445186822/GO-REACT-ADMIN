import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';

type MessageHandler = (event: { event: string; count?: number }) => void;

// Module-level shared WebSocket state
let sharedWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
let listeners = new Set<MessageHandler>();
let sharedConnected = false;
let activeToken: string | null = null;

function notifyListeners(data: { event: string; count?: number }) {
  listeners.forEach((fn) => {
    try {
      fn(data);
    } catch {
      // ignore listener errors
    }
  });
}

function notifyConnectionChange(connected: boolean) {
  sharedConnected = connected;
}

function connect(token: string) {
  if (sharedWs && sharedWs.readyState === WebSocket.OPEN && activeToken === token) {
    return; // already connected with same token
  }

  // Close existing if token changed
  if (sharedWs) {
    sharedWs.onclose = null;
    sharedWs.onerror = null;
    sharedWs.onmessage = null;
    sharedWs.close();
    sharedWs = null;
  }

  activeToken = token;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(
    `${protocol}//${window.location.host}/api/v1/notifications/ws?token=${encodeURIComponent(token)}`,
  );

  ws.onopen = () => {
    reconnectDelay = 1000;
    notifyConnectionChange(true);
    notifyListeners({ event: 'ws_connected' });
  };

  ws.onclose = () => {
    notifyConnectionChange(false);
    notifyListeners({ event: 'ws_disconnected' });
    sharedWs = null;
    // Auto-reconnect with exponential backoff
    scheduleReconnect();
  };

  ws.onerror = () => {
    notifyConnectionChange(false);
    notifyListeners({ event: 'ws_disconnected' });
  };

  ws.onmessage = (msgEvent) => {
    try {
      const data = JSON.parse(msgEvent.data);
      notifyListeners(data);
    } catch {
      // ignore parse errors
    }
  };

  sharedWs = ws;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  if (!activeToken) return;
  if (listeners.size === 0) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (listeners.size > 0 && activeToken) {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      connect(activeToken);
    }
  }, reconnectDelay);
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sharedWs) {
    sharedWs.onclose = null;
    sharedWs.onerror = null;
    sharedWs.onmessage = null;
    sharedWs.close();
    sharedWs = null;
  }
  sharedConnected = false;
  activeToken = null;
  reconnectDelay = 1000;
}

/**
 * Shared WebSocket hook for notification real-time updates.
 * Multiple components using this hook share a single WebSocket connection.
 * Supports automatic reconnection with exponential backoff (1s → 30s max).
 */
export function useNotificationWebSocket() {
  const token = useAuthStore((state) => state.accessToken);
  const [connected, setConnected] = useState(sharedConnected);
  const handlerRef = useRef<MessageHandler | null>(null);

  useEffect(() => {
    if (!token) {
      disconnect();
      setConnected(false);
      return;
    }

    const handler: MessageHandler = (data) => {
      if (data.event === 'ws_connected') setConnected(true);
      if (data.event === 'ws_disconnected') setConnected(false);
      if (handlerRef.current) handlerRef.current(data);
    };

    listeners.add(handler);

    // Ensure connection is active
    if (!sharedWs || sharedWs.readyState !== WebSocket.OPEN) {
      connect(token);
    } else {
      setConnected(true);
    }

    return () => {
      listeners.delete(handler);
      // If no more listeners, clean up connection
      if (listeners.size === 0) {
        disconnect();
      }
    };
  }, [token]);

  /**
   * Subscribe to specific WebSocket events (e.g., 'unread_count', 'notifications_changed').
   * Pass the handler as the second argument to the hook call or use onMessage ref.
   */
  const onMessage = (fn: MessageHandler) => {
    handlerRef.current = fn;
  };

  return { connected, onMessage };
}
