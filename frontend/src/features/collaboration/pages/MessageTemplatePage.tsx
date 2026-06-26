import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormSelect, ProFormText, ProFormTextArea, ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { useRef, useState } from 'react';
import {
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
  updateMessageTemplate,
  type MessageTemplateRow,
} from '../../../api/collaboration';
import { Permission } from '../../../components/Permission';

type TemplateForm = Omit<Partial<MessageTemplateRow>, 'variables'> & { variables_text?: string };

export function MessageTemplatePage() {
  const actionRef = useRef<ActionType>(null);
  const [editing, setEditing] = useState<MessageTemplateRow | null>(null);
  const [open, setOpen] = useState(false);

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
      valueType: 'option',
      width: 160,
      render: (_, row) => (
        <Space>
          <Permission code="message-template:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="message-template:delete">
            <Popconfirm
              title="删除模板？"
              onConfirm={async () => {
                await deleteMessageTemplate(row.id);
                message.success('模板已删除');
                actionRef.current?.reload();
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
    setOpen(true);
  }

  async function submit(values: TemplateForm) {
    const payload = { ...values, variables: parseJSON(values.variables_text || '[]') };
    delete payload.variables_text;
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
  }

  return (
    <div>
      <Typography.Title level={3}>消息模板</Typography.Title>
      <ProTable<MessageTemplateRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const data = await listMessageTemplates({
            keyword: typeof params.name === 'string' ? params.name : typeof params.code === 'string' ? params.code : undefined,
            category: typeof params.category === 'string' ? params.category : undefined,
            status: typeof params.status === 'string' ? params.status : undefined,
          });
          return {
            data,
            success: true,
          };
        }}
        pagination={{ defaultPageSize: 10 }}
        toolBarRender={() => [
          <Permission code="message-template:create" key="create">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              新增模板
            </Button>
          </Permission>,
        ]}
      />
      <ModalForm<TemplateForm>
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
            ? { ...editing, variables_text: JSON.stringify(editing.variables ?? [], null, 2) }
            : { category: 'system_notice', status: 'ACTIVE', variables_text: '[]' }
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
        <ProFormTextArea name="variables_text" label="变量 JSON" fieldProps={{ rows: 4 }} />
        <ProFormSelect name="status" label="状态" options={[{ label: '启用', value: 'ACTIVE' }, { label: '停用', value: 'DISABLED' }]} />
      </ModalForm>
    </div>
  );
}

function parseJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('变量 JSON 格式不正确');
  }
}
