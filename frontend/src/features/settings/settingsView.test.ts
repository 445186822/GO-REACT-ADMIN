import { describe, expect, it } from 'vitest';
import { groupSettingsForView } from './settingsView';
import type { SettingRow } from '../../api/settings';

const baseSetting: SettingRow = {
  id: 1,
  group_key: 'system',
  setting_key: 'system.name',
  setting_value: 'Enterprise Demo',
  value_type: 'string',
  description: 'System name',
  is_encrypted: false,
  updated_at: '2026-06-26T00:00:00Z',
};

describe('settings view grouping', () => {
  it('returns known enterprise setting groups before unknown groups', () => {
    const groups = groupSettingsForView([
      { ...baseSetting, group_key: 'ai', setting_key: 'ai.provider' },
      { ...baseSetting, group_key: 'custom', setting_key: 'custom.value' },
      { ...baseSetting, group_key: 'security', setting_key: 'security.session_timeout_minutes' },
    ]);

    expect(groups.map((group) => group.key)).toEqual(['system', 'security', 'file', 'notification', 'ai', 'custom']);
    expect(groups[1].title).toBe('安全策略');
    expect(groups[4].description).toContain('AI');
  });

  it('keeps settings inside their display group', () => {
    const groups = groupSettingsForView([
      baseSetting,
      { ...baseSetting, id: 2, group_key: 'notification', setting_key: 'notification.email_enabled' },
    ]);

    expect(groups.find((group) => group.key === 'system')?.items).toHaveLength(1);
    expect(groups.find((group) => group.key === 'notification')?.items[0].setting_key).toBe('notification.email_enabled');
  });
});
