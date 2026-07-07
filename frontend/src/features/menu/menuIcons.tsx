import { AppstoreOutlined } from '@ant-design/icons';
import { Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { generatedMenuIcons } from './menuIcons.generated';

export const menuIcons = generatedMenuIcons;

export const menuIconMap: Record<string, ReactNode> = Object.fromEntries(menuIcons.map((item) => [item.name, item.icon]));

export const menuIconOptions = menuIcons.map((item) => ({
  label: renderMenuIconLabel(item.name),
  value: item.name,
  searchLabel: `${formatIconLabel(item.name)} ${item.name}`,
}));

export function renderMenuIconNode(name?: string | null): ReactNode {
  return name ? (menuIconMap[name] ?? <AppstoreOutlined />) : undefined;
}

export function renderMenuIconLabel(name?: string | null): ReactNode {
  if (!name) {
    return <Typography.Text type="secondary">未设置</Typography.Text>;
  }

  return (
    <Space size={8}>
      {renderMenuIconNode(name)}
      <span>{formatIconLabel(name)}</span>
      <Typography.Text type="secondary">{name}</Typography.Text>
    </Space>
  );
}

export function renderMenuIconOption(name?: string | number | null): ReactNode {
  const iconName = name ? String(name) : '';

  return (
    <div className="menu-icon-option">
      <span className="menu-icon-option-preview">{renderMenuIconNode(iconName)}</span>
      <span className="menu-icon-option-name">{formatIconLabel(iconName)}</span>
    </div>
  );
}

function formatIconLabel(name: string) {
  return name
    .replace(/Outlined$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}
