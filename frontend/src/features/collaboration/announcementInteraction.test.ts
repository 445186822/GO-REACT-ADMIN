import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const announcementCenterSource = readFileSync(resolve(process.cwd(), 'src/features/collaboration/pages/AnnouncementCenterPage.tsx'), 'utf8');
const basicLayoutSource = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');

describe('announcement interactions', () => {
  it('uses detail modals as the read acknowledgement entry point', () => {
    expect(announcementCenterSource).toContain('AnnouncementDetailModal');
    expect(announcementCenterSource).toContain('详情');
    expect(announcementCenterSource).toContain('openAnnouncementDetail(row)');
    expect(announcementCenterSource).toContain('已读列表');
  });

  it('has read status modal for viewing reader details', () => {
    expect(announcementCenterSource).toContain('ReadStatusModal');
    expect(announcementCenterSource).toContain('handleViewReadStatus(row)');
  });

  it('supports expire action on announcements', () => {
    expect(announcementCenterSource).toContain('handleExpire(row)');
    expect(announcementCenterSource).toContain('过期');
  });

  it('shows read progress for each announcement', () => {
    expect(announcementCenterSource).toContain('read_count');
    expect(announcementCenterSource).toContain('total_count');
  });

  it('uses explicit notification status wording', () => {
    expect(announcementCenterSource).toContain('未读公告');
    expect(announcementCenterSource).toContain('实时连接：');
    expect(announcementCenterSource).toContain('已断开');
    expect(announcementCenterSource).toContain('重连');
  });

  it('opens announcement details from the header instead of navigating immediately', () => {
    expect(basicLayoutSource).toContain('AnnouncementDetailModal');
    expect(basicLayoutSource).toContain('handleAnnouncementClick');
    expect(basicLayoutSource).not.toContain('notificationNeedsRead');
  });

  it('refreshes the header badge when the auth token becomes available', () => {
    expect(basicLayoutSource).toContain('if (!accessToken) {');
    expect(basicLayoutSource).toContain('[accessToken, refreshNotificationSummary]');
  });

  it('navigates to announcement center on "view all"', () => {
    expect(basicLayoutSource).toContain("navigate('/collaboration/announcements')");
  });
});
