import { DeleteOutlined, EditOutlined, KeyOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalForm, ProFormSelect, ProFormText, ProTable, type ActionType } from '@ant-design/pro-components';
import { App, Button, Dropdown, Grid, Input, Modal, Pagination, Space, Tag, type MenuProps } from 'antd';
import { message } from '../../../utils/message';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createUser, deleteUser, listUsers, resetUserPassword, updateUser, type UserForm, type UserRow } from '../../../api/users';
import { listRoles, type RoleRow } from '../../../api/roles';
import { listDepartments, type DepartmentRow } from '../../../api/departments';
import { Permission } from '../../../components/Permission';
import { ExportButton } from '../../../components/ExportButton';
import { MobileRecordList, type MobileListColumn } from '../../../components/MobileRecordList';
import { exportExcel } from '../../../utils/exportExcel';
import { operationColumnProps } from '../../../utils/tableColumns';
import { useAuthStore } from '../../../store/authStore';

export function UserListPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const screens = Grid.useBreakpoint();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  const [mobileUsers, setMobileUsers] = useState<UserRow[]>([]);
  const [mobileTotal, setMobileTotal] = useState(0);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileKeyword, setMobileKeyword] = useState('');
  const [mobileLoading, setMobileLoading] = useState(false);

  const isMobile = screens.md === false || viewportWidth <= 768;
  const mobilePageSize = 10;

  useEffect(() => {
    listRoles().then(setRoles).catch(() => {});
    listDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchMobileUsers = useCallback(async () => {
    if (!isMobile) {
      return;
    }
    setMobileLoading(true);
    try {
      const data = await listUsers({
        keyword: mobileKeyword || undefined,
        page: mobilePage,
        page_size: mobilePageSize,
      });
      setMobileUsers(data.items);
      setMobileTotal(data.total);
    } finally {
      setMobileLoading(false);
    }
  }, [isMobile, mobileKeyword, mobilePage]);

  useEffect(() => {
    void fetchMobileUsers();
  }, [fetchMobileUsers]);

  const columns: MobileListColumn<UserRow>[] = [
    { title: '用户名', dataIndex: 'username', copyable: true, width: 160, mobile: { title: true, visible: true, priority: 1 } },
    { title: '姓名', dataIndex: 'display_name', width: 160, mobile: { visible: true, priority: 2 } },
    { title: '角色', dataIndex: 'roles', search: false, width: 130, mobile: { visible: true, priority: 3 } },
    { title: '邮箱', dataIndex: 'email', search: false, width: 170, mobile: { visible: true, priority: 6 } },
    { title: '手机', dataIndex: 'phone', search: false, width: 140, mobile: { visible: true, priority: 7 } },
    { title: '部门', dataIndex: 'department', search: false, width: 140, mobile: { visible: true, priority: 4 } },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        ACTIVE: { text: '启用', status: 'Success' },
        DISABLED: { text: '禁用', status: 'Default' },
      },
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status === 'ACTIVE' ? '启用' : '禁用'}</Tag>,
      mobile: {
        visible: true,
        priority: 5,
        render: (row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status === 'ACTIVE' ? '启用' : '禁用'}</Tag>,
      },
    },
    {
      title: '操作',
      ...operationColumnProps<UserRow>(260),
      render: (_, row) => (
        <Space wrap={false} size={4} className="table-action-buttons">
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

  function getUserActionMenuItems(row: UserRow): MenuProps['items'] {
    const items: MenuProps['items'] = [];
    if (hasPermission('user:update')) {
      items.push(
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: '编辑',
          onClick: () => openEdit(row),
        },
        {
          key: 'reset-password',
          icon: <KeyOutlined />,
          label: '重置密码',
          onClick: () => { setResetPwdUser(row); setNewPassword(''); },
        },
      );
    }
    if (hasPermission('user:delete')) {
      items.push({
        key: 'delete',
        icon: <DeleteOutlined />,
        label: '删除',
        danger: true,
        onClick: () => confirmDelete(row),
      });
    }
    return items;
  }

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
        reloadUsers();
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
    reloadUsers();
    return true;
  }

  function reloadUsers() {
    actionRef.current?.reload();
    void fetchMobileUsers();
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
  const departmentOptions = departments.map((d) => ({ label: d.name, value: d.id }));
  const renderMobileActions = (row: UserRow) => {
    const items = getUserActionMenuItems(row);
    if (!items?.length) {
      return null;
    }
    return (
      <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
        <Button type="text" size="small" className="table-row-more-button" icon={<MoreOutlined />} aria-label="更多操作" />
      </Dropdown>
    );
  };

  return (
    <div style={{ padding: '0 0 24px' }}>
      {isMobile ? (
        <MobileRecordList<UserRow>
          columns={columns}
          dataSource={mobileUsers}
          rowKey="id"
          loading={mobileLoading}
          actions={(row) => renderMobileActions(row)}
          toolbar={
            <>
              <Input.Search
                allowClear
                placeholder="搜索用户名、姓名"
                enterButton="搜索"
                onSearch={(value) => {
                  setMobilePage(1);
                  setMobileKeyword(value.trim());
                }}
              />
              <Space wrap>
                <ExportButton onClick={exportUsers}>导出 Excel</ExportButton>
                <Permission code="user:create">
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
                </Permission>
              </Space>
            </>
          }
          pagination={
            <Pagination
              current={mobilePage}
              pageSize={mobilePageSize}
              total={mobileTotal}
              showSizeChanger={false}
              size="small"
              onChange={(page) => setMobilePage(page)}
            />
          }
        />
      ) : (
        <ProTable<UserRow>
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          scroll={{ x: 'max-content' }}
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
      )}

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
          name="department_id"
          label="部门"
          options={departmentOptions}
          placeholder="选择用户部门"
          allowClear
        />
        <ProFormSelect
          name="role_ids"
          label="角色"
          options={roleOptions}
          placeholder="选择用户角色"
          mode="multiple"
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
