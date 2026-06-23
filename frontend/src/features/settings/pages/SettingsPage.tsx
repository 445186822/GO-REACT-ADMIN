import { EditOutlined, PlusOutlined } from '@ant-design/icons';
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
import { Button, Typography, message } from 'antd';
import { useRef, useState } from 'react';
import { listSettings, upsertSetting, type SettingForm, type SettingRow } from '../../../api/settings';
import { Permission } from '../../../components/Permission';
import { ExportButton } from '../../../components/ExportButton';
import { exportExcel } from '../../../utils/exportExcel';

export function SettingsPage() {
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SettingRow | null>(null);

  const columns: ProColumns<SettingRow>[] = [
    { title: '分组', dataIndex: 'group_key' },
    { title: '键', dataIndex: 'setting_key', copyable: true },
    { title: '值', dataIndex: 'setting_value', search: false, ellipsis: true },
    { title: '类型', dataIndex: 'value_type', search: false },
    { title: '说明', dataIndex: 'description', search: false, ellipsis: true },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime', search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
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
    actionRef.current?.reload();
    return true;
  }

  async function exportSettings() {
    const rows = await listSettings();
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
  }

  return (
    <div>
      <Typography.Title level={3}>系统配置</Typography.Title>
      <ProTable<SettingRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 80 }}
        request={async (params) => ({
          data: await listSettings({ group_key: params.group_key as string | undefined }),
          success: true,
        })}
        pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        toolBarRender={() => [
          <ExportButton key="export" onClick={exportSettings}>
            导出 Excel
          </ExportButton>,
          <Permission code="settings:update" key="create">
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
          </Permission>,
        ]}
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
            : { group_key: 'system', value_type: 'string', is_encrypted: false }
        }
        onFinish={submit}
      >
        <ProFormText name="group_key" label="分组" rules={[{ required: true }]} />
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

