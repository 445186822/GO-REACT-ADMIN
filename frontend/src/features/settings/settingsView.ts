import type { SettingRow } from '../../api/settings';

export type SettingGroupView = {
  key: string;
  title: string;
  description: string;
  items: SettingRow[];
};

const GROUPS: Array<Omit<SettingGroupView, 'items'>> = [
  { key: 'system', title: '基础信息', description: '系统名称、品牌标识、默认语言和运行模式。' },
  { key: 'security', title: '安全策略', description: '登录会话、密码规则、审计保留和访问控制策略。' },
  { key: 'file', title: '文件与存储', description: '上传限制、允许的文件类型和存储路径。' },
  { key: 'notification', title: '通知设置', description: '站内信、邮件、审批提醒和系统告警开关。' },
  { key: 'ai', title: 'AI 设置', description: 'AI 助手提供商、模型、调用地址和功能开关。' },
];

export function groupSettingsForView(settings: SettingRow[]): SettingGroupView[] {
  const known = GROUPS.map((group) => ({
    ...group,
    items: settings.filter((item) => item.group_key === group.key),
  }));
  const knownKeys = new Set(GROUPS.map((group) => group.key));
  const unknownKeys = Array.from(new Set(settings.map((item) => item.group_key).filter((key) => !knownKeys.has(key)))).sort();
  const unknown = unknownKeys.map((key) => ({
    key,
    title: key,
    description: '自定义配置分组。',
    items: settings.filter((item) => item.group_key === key),
  }));
  return [...known, ...unknown].filter((group) => group.items.length > 0 || knownKeys.has(group.key));
}

export function settingValuePreview(row: SettingRow) {
  if (row.is_encrypted) return '******';
  if (row.value_type === 'boolean') return row.setting_value === 'true' ? '启用' : '停用';
  return row.setting_value;
}
