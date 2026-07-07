import { describe, expect, it } from 'vitest';
import { notificationNeedsRead, notificationReadPlaceholder, notificationReadText, notificationReadTimeText, notificationTypeText } from './notificationDetail';

describe('notification detail helpers', () => {
  it('marks only unread notifications as needing read acknowledgement', () => {
    expect(notificationNeedsRead({ read_at: null })).toBe(true);
    expect(notificationNeedsRead({ read_at: '2026-07-07 10:30:00' })).toBe(false);
  });

  it('formats notification detail labels', () => {
    expect(notificationReadText({ read_at: null })).toBe('未读');
    expect(notificationReadText({ read_at: '2026-07-07 10:30:00' })).toBe('已读');
    expect(notificationTypeText('approval')).toBe('审批');
    expect(notificationTypeText('custom')).toBe('custom');
  });

  it('does not display read status placeholders as timestamps', () => {
    expect(notificationReadTimeText(null)).toBe('打开详情后标记为已读');
    expect(notificationReadTimeText(notificationReadPlaceholder())).toBe('刚刚标记已读');
    expect(notificationReadTimeText('2026-07-07 14:00:09')).toBe('2026-07-07 14:00:09');
  });
});
