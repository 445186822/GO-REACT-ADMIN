import { DeleteOutlined, EditOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormSelect, ProFormText, ProFormTextArea, ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Input, Popconfirm, Space, Tag, Typography } from 'antd';
import { message } from '../../../utils/message';
import { useRef, useState } from 'react';
import {
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
  updateMessageTemplate,
  type MessageTemplateRow,
} from '../../../api/collaboration';
import { Permission } from '../../../components/Permission';
import { operationColumnProps } from '../../../utils/tableColumns';

type VariablePair = { key: string; value: string };

interface TemplateFormValues {
  code?: string;
  name?: string;
  category?: string;
  subject?: string;
  content?: string;
  status?: string;
}

export function MessageTemplatePage() {
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<MessageTemplateRow | null>(null);
  const [open, setOpen] = useState(false);
  const [variables, setVariables] = useState<VariablePair[]>([{ key: '', value: '' }]);

  const columns: ProColumns<MessageTemplateRow>[] = [
    { title: '编码', dataIndex: 'code', copyable: true },
    { title: '名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'category', width: 150 },
    { title: '主题', dataIndex: 'subject', search: false, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      search: false,
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime', search: false, width: 180 },
    {
      title: '操作',
      ...operationColumnProps<MessageTemplateRow>(180),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="message-template:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="message-template:delete">
            <Popconfirm
              title="删除模板？"
              onConfirm={async () => {
                try {
                  await deleteMessageTemplate(row.id);
                  message.success('模板已删除');
                  actionRef.current?.reload();
                } catch {
                  message.error('删除模板失败，请稍后重试');
                }
              }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Permission>
        </Space>
      ),
    },
  ];

  function openEdit(row: MessageTemplateRow) {
    setEditing(row);
    const vars = Array.isArray(row.variables) ? row.variables : [];
    const pairs: VariablePair[] = vars.map((v: unknown) => {
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        const obj = v as Record<string, string>;
        const entries = Object.entries(obj);
        if (entries.length > 0) {
          return { key: entries[0][0], value: entries[0][1] ?? '' };
        }
      }
      return { key: String(v), value: '' };
    });
    setVariables(pairs.length > 0 ? pairs : [{ key: '', value: '' }]);
    setOpen(true);
  }

  function addVariable() {
    setVariables((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeVariable(index: number) {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariable(index: number, field: 'key' | 'value', val: string) {
    setVariables((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: val } : v)));
  }

  function serializeVariables(): unknown[] {
    return variables
      .filter((v) => v.key.trim() !== '')
      .map((v) => ({ [v.key.trim()]: v.value }));
  }

  async function submit(values: TemplateFormValues) {
    try {
      const payload = { ...values, variables: serializeVariables() };
      if (editing) {
        await updateMessageTemplate(editing.id, payload);
      } else {
        await createMessageTemplate(payload);
      }
      message.success('模板已保存');
      setOpen(false);
      setEditing(null);
      actionRef.current?.reload();
      return true;
    } catch {
      message.error('保存模板失败，请稍后重试');
      return false;
    }
  }

  return (
    <div>
      <ProTable<MessageTemplateRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const data = await listMessageTemplates({
              keyword: typeof params.name === 'string' ? params.name : typeof params.code === 'string' ? params.code : undefined,
              category: typeof params.category === 'string' ? params.category : undefined,
              status: typeof params.status === 'string' ? params.status : undefined,
            });
            return { data, success: true };
          } catch {
            message.error('加载模板列表失败');
            return { data: [], success: false };
          }
        }}
        pagination={{ defaultPageSize: 10 }}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <Permission code="message-template:create" key="create">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setVariables([{ key: '', value: '' }]); setOpen(true); }}>
              新增模板
            </Button>
          </Permission>,
        ]}
      />
      <ModalForm<TemplateFormValues>
        title={editing ? '编辑模板' : '新增模板'}
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
            ? { code: editing.code, name: editing.name, category: editing.category, subject: editing.subject, content: editing.content, status: editing.status }
            : { category: 'system_notice', status: 'ACTIVE' }
        }
        onFinish={submit}
      >
        <ProFormText name="code" label="编码" disabled={Boolean(editing)} rules={[{ required: true }]} />
        <ProFormText name="name" label="名称" rules={[{ required: true }]} />
        <ProFormSelect
          name="category"
          label="分类"
          options={[
            { label: '系统通知', value: 'system_notice' },
            { label: '业务提醒', value: 'business_remind' },
            { label: '审批通知', value: 'approval_notice' },
            { label: '预警告警', value: 'warning_alert' },
          ]}
        />
        <ProFormText name="subject" label="主题" rules={[{ required: true }]} />
        <ProFormTextArea name="content" label="内容" fieldProps={{ rows: 5 }} />

        {/* Key-Value Variable Editor */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Typography.Text strong>变量</Typography.Text>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addVariable}>
              添加变量
            </Button>
          </div>
          {variables.map((v, index) => (
            <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Input
                placeholder="变量名"
                value={v.key}
                onChange={(e) => updateVariable(index, 'key', e.target.value)}
                style={{ width: 150 }}
              />
              <Input
                placeholder="变量值"
                value={v.value}
                onChange={(e) => updateVariable(index, 'value', e.target.value)}
                style={{ flex: 1 }}
              />
              {variables.length > 1 && (
                <Button
                  type="link"
                  danger
                  icon={<MinusCircleOutlined />}
                  onClick={() => removeVariable(index)}
                />
              )}
            </div>
          ))}
        </div>

        <ProFormSelect name="status" label="状态" options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'DISABLED' }]} />
      </ModalForm>
    </div>
  );
}
