import type { NotificationRow } from '../../api/collaboration';

const READ_PLACEHOLDER = '__just_read__';

export function notificationTypeText(type: string) {
  if (type === 'system') return '系统';
  if (type === 'business') return '业务';
  if (type === 'approval') return '审批';
  return type || '消息';
}

export function notificationReadText(row: Pick<NotificationRow, 'read_at'>) {
  return row.read_at ? '已读' : '未读';
}

export function notificationNeedsRead(row: Pick<NotificationRow, 'read_at'>) {
  return !row.read_at;
}

export function notificationReadPlaceholder() {
  return READ_PLACEHOLDER;
}

export function notificationReadTimeText(readAt?: string | null) {
  if (!readAt) {
    return '打开详情后标记为已读';
  }
  if (readAt === READ_PLACEHOLDER) {
    return '刚刚标记已读';
  }
  return readAt;
}
