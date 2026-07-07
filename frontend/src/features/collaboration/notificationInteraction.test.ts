import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const notificationCenterSource = readFileSync(resolve(process.cwd(), 'src/features/collaboration/pages/NotificationCenterPage.tsx'), 'utf8');
const basicLayoutSource = readFileSync(resolve(process.cwd(), 'src/layouts/BasicLayout.tsx'), 'utf8');

describe('notification interactions', () => {
  it('uses detail dialogs as the read acknowledgement entry point', () => {
    expect(notificationCenterSource).toContain('NotificationDetailModal');
    expect(notificationCenterSource).toContain('详情');
    expect(notificationCenterSource).toContain('openNotificationDetail(row)');
    expect(notificationCenterSource).not.toContain('CheckOutlined');
  });

  it('uses explicit notification status wording', () => {
    expect(notificationCenterSource).toContain('未读消息');
    expect(notificationCenterSource).toContain('实时连接：');
    expect(notificationCenterSource).toContain('已断开');
    expect(notificationCenterSource).toContain('重连');
  });

  it('opens notification details from the header instead of navigating immediately', () => {
    expect(basicLayoutSource).toContain('NotificationDetailModal');
    expect(basicLayoutSource).toContain('setSelectedNotification(row)');
    expect(basicLayoutSource).toContain('notificationNeedsRead(row)');
  });
});
