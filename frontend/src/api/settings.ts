import { http } from '../request/http';

export type SettingRow = {
  id: number;
  group_key: string;
  setting_key: string;
  setting_value: string;
  value_type: string;
  description?: string | null;
  is_encrypted: boolean;
  updated_at: string;
};

export type SettingForm = {
  group_key: string;
  setting_key: string;
  setting_value: string;
  value_type?: string;
  description?: string;
  is_encrypted?: boolean;
};

export async function listSettings(params?: { group_key?: string }): Promise<SettingRow[]> {
  const res = await http.get<unknown, { data: SettingRow[] }>('/settings', { params });
  return res.data;
}

export async function upsertSetting(payload: SettingForm): Promise<{ id: number }> {
  const { setting_key, ...body } = payload;
  const res = await http.put<unknown, { data: { id: number } }>(`/settings/${encodeURIComponent(setting_key)}`, body);
  return res.data;
}
