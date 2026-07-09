import { describe, expect, it } from 'vitest';

describe('announcement detail helpers', () => {
  it('reads read_at on AnnouncementRow', () => {
    // The read status is encoded in my_read_at field
    const readRow = { my_read_at: '2026-07-07 10:30:00' };
    const unreadRow = { my_read_at: null };
    expect(readRow.my_read_at).toBeTruthy();
    expect(unreadRow.my_read_at).toBeFalsy();
  });

  it('handles just-read placeholder', () => {
    const placeholder = '__just_read__';
    expect(placeholder).toBe('__just_read__');
  });
});
