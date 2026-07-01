import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import { Button, Space, Tabs, Tag, Typography } from 'antd';
import { message } from '../../../utils/message';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listSettings, upsertSetting, type SettingForm, type SettingRow } from '../../../api/settings';
import { ExportButton } from '../../../components/ExportButton';
import { Permission } from '../../../components/Permission';
import { exportExcel } from '../../../utils/exportExcel';
import { groupSettingsForView, settingValuePreview } from '../settingsView';
import { operationColumnProps } from '../../../utils/tableColumns';

const { Text } = Typography;

export function SettingsPage() {
  const actionRef = useRef<ActionType>(null);
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [activeGroup, setActiveGroup] = useState('system');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const groups = useMemo(() => groupSettingsForView(rows), [rows]);
  const active = groups.find((group) => group.key === activeGroup) ?? groups[0];

  async function loadSettings() {
    const data = await listSettings();
    setRows(data);
    if (!data.some((item) => item.group_key === activeGroup)) {
      const firstGroup = groupSettingsForView(data)[0];
      if (firstGroup) setActiveGroup(firstGroup.key);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  const columns: ProColumns<SettingRow>[] = [
    { title: '配置键', dataIndex: 'setting_key', copyable: true, width: 150 },
    {
      title: '配置值',
      dataIndex: 'setting_value',
      search: false,
      ellipsis: true,
      render: (_, row) => <Text className="settings-value" ellipsis>{settingValuePreview(row)}</Text>,
    },
    { title: '类型', dataIndex: 'value_type', width: 100, search: false, render: (_, row) => <Tag>{row.value_type}</Tag> },
    { title: '说明', dataIndex: 'description', search: false, ellipsis: true, width: 200 },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime', width: 170, search: false },
    {
      title: '操作',
      ...operationColumnProps<SettingRow>(120),
      render: (_, row) => (
        <Permission code="settings:update">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            编辑
          </Button>
        </Permission>
      ),
    },
  ];

  function openEdit(row: SettingRow) {
    setEditing(row);
    setOpen(true);
  }

  async function submit(values: SettingForm) {
    await upsertSetting(values);
    message.success('配置已保存');
    setOpen(false);
    setEditing(null);
    await loadSettings();
    actionRef.current?.reload();
    return true;
  }

  async function exportSettings() {
    try {
      await exportExcel<SettingRow>(
        'settings.xlsx',
        'Settings',
        [
          { title: 'ID', dataIndex: 'id' },
          { title: '分组', dataIndex: 'group_key' },
          { title: '键', dataIndex: 'setting_key' },
          { title: '值', dataIndex: 'setting_value' },
          { title: '类型', dataIndex: 'value_type' },
          { title: '说明', dataIndex: 'description' },
          { title: '加密', dataIndex: 'is_encrypted' },
          { title: '更新时间', dataIndex: 'updated_at' },
        ],
        rows,
      );
      message.success('系统配置 Excel 已生成');
    } catch {
      message.error('导出失败');
    }
  }

  return (
    <div className="settings-workspace">
      <div className="settings-header">
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadSettings}>刷新</Button>
          <ExportButton onClick={exportSettings}>导出 Excel</ExportButton>
          <Permission code="settings:update">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              新增配置
            </Button>
          </Permission>
        </Space>
      </div>

      <Tabs
        className="settings-group-tabs"
        activeKey={active?.key}
        onChange={setActiveGroup}
        items={groups.map((group) => ({
          key: group.key,
          label: `${group.title} (${group.items.length})`,
          children: (
            <>
              <div className="settings-group-summary">
                <div>
                  <Text strong>{group.title}</Text>
                  <br />
                  <Text type="secondary">{group.description}</Text>
                </div>
              </div>
              <ProTable<SettingRow>
                key={`${group.key}-${group.items.length}`}
                actionRef={actionRef}
                rowKey="id"
                columns={columns}
                scroll={{ x: 'max-content' }}
                request={async (params) => {
                  const keyword = String(params.setting_key ?? '').trim().toLowerCase();
                  const data = keyword
                    ? group.items.filter((item) =>
                        [item.setting_key, item.setting_value, item.description ?? ''].some((value) => value.toLowerCase().includes(keyword)),
                      )
                    : group.items;
                  return { data, success: true };
                }}
                search={{ labelWidth: 80 }}
                options={false}
                pagination={{ defaultPageSize: 10, showSizeChanger: false }}
              />
            </>
          ),
        }))}
      />

      <ModalForm<SettingForm>
        title={editing ? '编辑配置' : '新增配置'}
        open={open}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            setOpen(false);
            setEditing(null);
          },
        }}
        initialValues={
          editing
            ? {
                group_key: editing.group_key,
                setting_key: editing.setting_key,
                setting_value: editing.setting_value,
                value_type: editing.value_type,
                description: editing.description ?? undefined,
                is_encrypted: editing.is_encrypted,
              }
            : { group_key: activeGroup || 'system', value_type: 'string', is_encrypted: false }
        }
        onFinish={submit}
      >
        <ProFormSelect
          name="group_key"
          label="分组"
          rules={[{ required: true }]}
          options={[
            { label: '基础信息', value: 'system' },
            { label: '安全策略', value: 'security' },
            { label: '文件与存储', value: 'file' },
            { label: '通知设置', value: 'notification' },
            { label: 'AI 设置', value: 'ai' },
          ]}
        />
        <ProFormText name="setting_key" label="键" disabled={Boolean(editing)} rules={[{ required: true }]} />
        <ProFormTextArea name="setting_value" label="值" rules={[{ required: true }]} fieldProps={{ rows: 4 }} />
        <ProFormSelect
          name="value_type"
          label="类型"
          options={[
            { label: 'string', value: 'string' },
            { label: 'number', value: 'number' },
            { label: 'boolean', value: 'boolean' },
            { label: 'json', value: 'json' },
          ]}
        />
        <ProFormText name="description" label="说明" />
        <ProFormSwitch name="is_encrypted" label="加密" />
      </ModalForm>
    </div>
  );
}
