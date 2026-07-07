import { describe, expect, it } from 'vitest';
import { formatApiTimes } from './timeFormat';

describe('formatApiTimes', () => {
  it('formats ISO datetime fields ending with _at or _time', () => {
    expect(
      formatApiTimes({
        created_at: '2026-06-28T16:10:54.21309+08:00',
        submitted_time: '2026-06-29T20:47:24.518416+08:00',
      }),
    ).toEqual({
      created_at: '2026-06-28 16:10:54',
      submitted_time: '2026-06-29 20:47:24',
    });
  });

  it('formats nested objects and arrays', () => {
    expect(
      formatApiTimes({
        data: {
          items: [
            { id: 1, updated_at: '2026-06-29T20:48:09.64516+08:00' },
            { id: 2, read_at: null },
          ],
        },
      }),
    ).toEqual({
      data: {
        items: [
          { id: 1, updated_at: '2026-06-29 20:48:09' },
          { id: 2, read_at: null },
        ],
      },
    });
  });

  it('does not change non-time strings or already formatted values', () => {
    expect(
      formatApiTimes({
        title: '2026-06-28T16:10:54.21309+08:00',
        created_at: '2026-06-28 16:10:54',
        biz_type: 'leave_demo',
      }),
    ).toEqual({
      title: '2026-06-28T16:10:54.21309+08:00',
      created_at: '2026-06-28 16:10:54',
      biz_type: 'leave_demo',
    });
  });

  it('preserves binary response blobs', () => {
    const blob = new Blob(['xlsx-content'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    expect(formatApiTimes(blob)).toBe(blob);
  });
});
