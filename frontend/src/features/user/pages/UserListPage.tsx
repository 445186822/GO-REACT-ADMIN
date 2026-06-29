import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormSelect, ProFormText, ProTable, type ActionType } from '@ant-design/pro-components';
import { App, Button, Input, Modal, Space, Tag } from 'antd';
import { message } from '../../../utils/message';
import { useEffect, useRef, useState } from 'react';
import { createUser, deleteUser, listUsers, resetUserPassword, updateUser, type UserForm, type UserRow } from '../../../api/users';
import { listRoles, type RoleRow } from '../../../api/roles';
import { Permission } from '../../../components/Permission';
import { ExportButton } from '../../../components/ExportButton';
import { exportExcel } from '../../../utils/exportExcel';
import { operationColumnProps } from '../../../utils/tableColumns';

export function UserListPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([]);

  useEffect(() => {
    listRoles().then(setRoles).catch(() => {});
  }, []);

  const columns: ProColumns<UserRow>[] = [
    { title: '用户名', dataIndex: 'username', copyable: true },
    { title: '姓名', dataIndex: 'display_name' },
    { title: '角色', dataIndex: 'roles', search: false },
    { title: '邮箱', dataIndex: 'email', search: false },
    { title: '手机', dataIndex: 'phone', search: false },
    { title: '部门', dataIndex: 'department', search: false },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        ACTIVE: { text: '启用', status: 'Success' },
        DISABLED: { text: '禁用', status: 'Default' },
      },
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status === 'ACTIVE' ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      ...operationColumnProps<UserRow>(260),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="user:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="user:update">
            <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => { setResetPwdUser(row); setNewPassword(''); }}>
              重置密码
            </Button>
          </Permission>
          <Permission code="user:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function openEdit(row: UserRow) {
    setEditing(row);
    setOpen(true);
  }

  function confirmDelete(row: UserRow) {
    modal.confirm({
      title: `删除用户 ${row.display_name}?`,
      content: '删除后该用户将无法登录，数据采用软删除保留审计痕迹。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteUser(row.id);
        message.success('用户已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: UserForm) {
    if (editing) {
      await updateUser(editing.id, values);
      message.success('用户已更新');
    } else {
      await createUser(values);
      message.success('用户已创建');
    }
    setOpen(false);
    setEditing(null);
    actionRef.current?.reload();
    return true;
  }

  async function exportUsers() {
    const data = await listUsers({ page: 1, page_size: 10000 });
    await exportExcel<UserRow>(
      'users.xlsx',
      'Users',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '用户名', dataIndex: 'username' },
        { title: '姓名', dataIndex: 'display_name' },
        { title: '角色', dataIndex: 'roles' },
        { title: '邮箱', dataIndex: 'email' },
        { title: '手机', dataIndex: 'phone' },
        { title: '部门', dataIndex: 'department' },
        { title: '状态', dataIndex: 'status' },
      ],
      data.items,
    );
    message.success('用户 Excel 已生成');
  }

  const roleOptions = roles.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }));

  return (
    <div style={{ padding: '0 0 24px' }}>
      <ProTable<UserRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 80 }}
        request={async (params) => {
          const data = await listUsers({
            keyword: params.keyword as string | undefined,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <ExportButton key="export" onClick={exportUsers}>
            导出 Excel
          </ExportButton>,
          <Permission code="user:create" key="create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              新增用户
            </Button>
          </Permission>,
        ]}
      />

      <ModalForm<UserForm>
        title={editing ? '编辑用户' : '新增用户'}
        open={open}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            setOpen(false);
            setEditing(null);
          },
        }}
        initialValues={editing ?? { status: 'ACTIVE' }}
        onFinish={submit}
      >
        {!editing && <ProFormText name="username" label="用户名" rules={[{ required: true }]} />}
        {!editing && <ProFormText.Password name="password" label="初始密码" rules={[{ required: true, min: 6 }]} />}
        <ProFormText name="display_name" label="姓名" rules={[{ required: true }]} />
        <ProFormText name="email" label="邮箱" />
        <ProFormText name="phone" label="手机" />
        <ProFormSelect
          name="role_id"
          label="角色"
          options={roleOptions}
          placeholder="选择用户角色"
          allowClear
        />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 'ACTIVE' },
            { label: '禁用', value: 'DISABLED' },
          ]}
        />
      </ModalForm>

      {/* Password Reset Modal */}
      <Modal
        title={`重置密码 - ${resetPwdUser?.display_name || ''}`}
        open={Boolean(resetPwdUser)}
        onCancel={() => { setResetPwdUser(null); setNewPassword(''); }}
        confirmLoading={resetting}
        onOk={async () => {
          if (!resetPwdUser || !newPassword.trim()) {
            message.warning('请输入新密码');
            return;
          }
          if (newPassword.trim().length < 6) {
            message.warning('密码长度不能少于6位');
            return;
          }
          setResetting(true);
          try {
            await resetUserPassword(resetPwdUser.id, newPassword.trim());
            message.success('密码已重置');
            setResetPwdUser(null);
            setNewPassword('');
          } catch {
            message.error('密码重置失败');
          } finally {
            setResetting(false);
          }
        }}
      >
        <Input.Password
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="输入新密码（至少6位）"
        />
      </Modal>
    </div>
  );
}
