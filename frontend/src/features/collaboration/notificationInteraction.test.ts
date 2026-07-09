import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const notificationCenterSource = readFileSync(resolve(process.cwd(), 'src/features/collaboration/pages/AnnouncementCenterPage.tsx'), 'utf8');
const basicLayoutSource = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');

describe('notification interactions', () => {
  it('uses detail modals as the read acknowledgement entry point', () => {
    expect(notificationCenterSource).toContain('AnnouncementDetailModal');
    expect(notificationCenterSource).toContain('详情');
    expect(notificationCenterSource).toContain('openAnnouncementDetail(row)');
    expect(notificationCenterSource).not.toContain('NotificationDetailModal');
  });

  it('shows explicit notification status wording', () => {
    expect(notificationCenterSource).toContain('未读公告');
    expect(notificationCenterSource).toContain('实时连接：');
    expect(notificationCenterSource).toContain('已断开');
    expect(notificationCenterSource).toContain('重连');
  });

  it('opens announcement details from the header instead of navigating immediately', () => {
    expect(basicLayoutSource).toContain('AnnouncementDetailModal');
    expect(basicLayoutSource).toContain('setSelectedAnnouncement(row)');
    expect(basicLayoutSource).toContain('handleAnnouncementClick');
  });
});
