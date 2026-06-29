/**
 * Unified message/modal/notification holder for antd v5.
 *
 * Because the entire app is wrapped in <AntdApp> (in AppThemeProvider),
 * static `import { message } from 'antd'` creates an independent mount
 * point and may not show notifications correctly.
 *
 * Instead, we hold the real instances from App.useApp() here, and every
 * page imports from this module instead of 'antd'.
 */

import type { MessageInstance } from 'antd/es/message/interface';
import type { ModalStaticFunctions } from 'antd/es/modal/confirm';
import type { NotificationInstance } from 'antd/es/notification/interface';

type ModalAPI = Omit<ModalStaticFunctions, 'warn'>;

let _message: MessageInstance | null = null;
let _modal: ModalAPI | null = null;
let _notification: NotificationInstance | null = null;

/** Call once from inside <AntdApp> (AppThemeProvider) */
export function initAppApi(api: {
  message: MessageInstance;
  modal: ModalAPI;
  notification: NotificationInstance;
}) {
  _message = api.message;
  _modal = api.modal;
  _notification = api.notification;
}

function ensure<T>(v: T | null, name: string): T {
  if (!v) throw new Error(`[message util] ${name} not initialised — call initAppApi first`);
  return v;
}

export const message: MessageInstance = new Proxy({} as MessageInstance, {
  get(_, prop) {
    return (...args: any[]) => (ensure(_message, 'message') as any)[prop](...args);
  },
});

export const modal: ModalAPI = new Proxy({} as ModalAPI, {
  get(_, prop) {
    return (...args: any[]) => (ensure(_modal, 'modal') as any)[prop](...args);
  },
});

export const notification: NotificationInstance = new Proxy({} as NotificationInstance, {
  get(_, prop) {
    return (...args: any[]) => (ensure(_notification, 'notification') as any)[prop](...args);
  },
});
