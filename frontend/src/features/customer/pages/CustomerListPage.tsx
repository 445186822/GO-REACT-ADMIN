import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import { App, Button, Space, Tag, Typography, message } from 'antd';
import { useRef, useState } from 'react';
import {
  createCustomer,
  deleteCustomer,
  exportCustomers,
  listCustomers,
  updateCustomer,
  type CustomerForm,
  type CustomerRow,
} from '../../../api/customers';
import { BackendDownloadButton } from '../../../components/BackendDownloadButton';
import { Permission } from '../../../components/Permission';

export function CustomerListPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);

  const columns: ProColumns<CustomerRow>[] = [
    { title: '客户名称', dataIndex: 'name', copyable: true },
    {
      title: '级别',
      dataIndex: 'level',
      valueType: 'select',
      valueEnum: {
        IMPORTANT: { text: '重点客户' },
        NORMAL: { text: '普通客户' },
        POTENTIAL: { text: '潜在客户' },
      },
      render: (_, row) => <Tag color={row.level === 'IMPORTANT' ? 'red' : row.level === 'POTENTIAL' ? 'blue' : 'default'}>{levelText(row.level)}</Tag>,
    },
    { title: '负责人', dataIndex: 'owner', search: false },
    { title: '所属部门', dataIndex: 'department', search: false },
    { title: '手机', dataIndex: 'phone', search: false },
    { title: '邮箱', dataIndex: 'email', search: false },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        ACTIVE: { text: '有效', status: 'Success' },
        DISABLED: { text: '停用', status: 'Default' },
      },
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status === 'ACTIVE' ? '有效' : '停用'}</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, row) => (
        <Space>
          <Permission code="customer:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="customer:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function openEdit(row: CustomerRow) {
    setEditing(row);
    setOpen(true);
  }

  function confirmDelete(row: CustomerRow) {
    modal.confirm({
      title: `删除客户 ${row.name}?`,
      content: '客户采用软删除，后续可扩展回收站和审计日志。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteCustomer(row.id);
        message.success('客户已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: CustomerForm) {
    if (editing) {
      await updateCustomer(editing.id, values);
      message.success('客户已更新');
    } else {
      await createCustomer(values);
      message.success('客户已创建');
    }
    setOpen(false);
    setEditing(null);
    actionRef.current?.reload();
    return true;
  }

  async function handleExportCustomers() {
    await exportCustomers();
    message.success('客户 Excel 已生成');
  }

  return (
    <div>
      <Typography.Title level={3}>客户管理</Typography.Title>
      <ProTable<CustomerRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 80 }}
        request={async (params) => {
          const data = await listCustomers({
            keyword: params.keyword as string | undefined,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        toolBarRender={() => [
          <BackendDownloadButton key="export" onClick={handleExportCustomers}>
            导出 Excel
          </BackendDownloadButton>,
          <Permission code="customer:create" key="create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              新增客户
            </Button>
          </Permission>,
        ]}
      />

      <ModalForm<CustomerForm>
        title={editing ? '编辑客户' : '新增客户'}
        open={open}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            setOpen(false);
            setEditing(null);
          },
        }}
        initialValues={editing ?? { level: 'NORMAL', status: 'ACTIVE' }}
        onFinish={submit}
      >
        <ProFormText name="name" label="客户名称" rules={[{ required: true }]} />
        <ProFormSelect
          name="level"
          label="客户级别"
          options={[
            { label: '重点客户', value: 'IMPORTANT' },
            { label: '普通客户', value: 'NORMAL' },
            { label: '潜在客户', value: 'POTENTIAL' },
          ]}
        />
        <ProFormText name="phone" label="手机" />
        <ProFormText name="email" label="邮箱" />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '有效', value: 'ACTIVE' },
            { label: '停用', value: 'DISABLED' },
          ]}
        />
        <ProFormTextArea name="remark" label="备注" fieldProps={{ rows: 3 }} />
      </ModalForm>
    </div>
  );
}

function levelText(level: CustomerRow['level']) {
  if (level === 'IMPORTANT') return '重点客户';
  if (level === 'POTENTIAL') return '潜在客户';
  return '普通客户';
}

