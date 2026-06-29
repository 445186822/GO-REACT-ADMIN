import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, Input, Modal, Popconfirm, Select, Spin, Tag, Tree, Typography} from 'antd';
import { message } from '../../../utils/message';
import type { DataNode } from 'antd/es/tree';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { MenuRow } from '../../../api/menus';
import { listMenus } from '../../../api/menus';
import {
  type RoleRow,
  createRole,
  deleteRole,
  listRoleMenus,
  listRoles,
  updateRole,
  updateRoleMenus,
} from '../../../api/roles';
import { ExportButton } from '../../../components/ExportButton';
import { useAuthStore } from '../../../store/authStore';
import { exportExcel } from '../../../utils/exportExcel';
import { operationColumnProps } from '../../../utils/tableColumns';

const { Text } = Typography;

/* ---------- helpers ---------- */

function buildMenuTree(flat: MenuRow[]): DataNode[] {
  const map = new Map<number, DataNode>();
  const roots: DataNode[] = [];
  for (const m of flat) {
    map.set(m.id, {
      key: String(m.id),
      title: `${m.name}  (${m.code})`,
      children: [],
    });
  }
  for (const m of flat) {
    const node = map.get(m.id);
    if (!node) continue;
    if (m.parent_id && map.has(m.parent_id)) {
      map.get(m.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/* ========== Page ========== */

export function RoleListPage() {
  const perms = useAuthStore((s) => s.user?.permissions ?? []);
  const canUpdate = perms.includes('role:update');
  const canCreate = perms.includes('role:create');
  const canDelete = perms.includes('role:delete');

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------- menus (once) ----------
  const [allMenus, setAllMenus] = useState<MenuRow[]>([]);
  useEffect(() => {
    listMenus().then(setAllMenus).catch(() => {});
  }, []);
  const menuTree = useMemo(() => buildMenuTree(allMenus), [allMenus]);

  // ---------- edit / create modal ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [form] = Form.useForm();
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const firstOpen = useRef(true);

  // ---------- load ----------
  async function loadRoles() {
    setLoading(true);
    try {
      setRoles(await listRoles());
    } catch {
      message.error('加载角色列表失败');
    } finally {
      setLoading(false);
    }
  }

  async function exportRoles() {
    const rows = await listRoles();
    await exportExcel<RoleRow>(
      'roles.xlsx', 'Roles',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '角色编码', dataIndex: 'code' },
        { title: '角色名称', dataIndex: 'name' },
        { title: '说明', dataIndex: 'description' },
        { title: '状态', dataIndex: 'status' },
      ],
      rows,
    );
    message.success('角色 Excel 已生成');
  }
  useEffect(() => {
    void loadRoles();
  }, []);

  // ---------- open modal ----------
  function openCreateModal() {
    setEditingRole(null);
    form.resetFields();
    setCheckedKeys([]);
    setModalOpen(true);
  }

  async function openEditModal(role: RoleRow) {
    setEditingRole(role);
    setModalOpen(true);
    // load menu IDs for this role
    try {
      setCheckedKeys((await listRoleMenus(role.id)).map(String));
    } catch {
      setCheckedKeys([]);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRole(null);
    setCheckedKeys([]);
    form.resetFields();
  }

  // ---------- set form fields AFTER modal DOM is mounted ----------
  useEffect(() => {
    if (!modalOpen) return;

    const timer = setTimeout(() => {
      if (editingRole) {
        form.setFieldsValue({
          name: editingRole.name,
          description: editingRole.description || '',
          status: editingRole.status,
        });
      } else {
        form.resetFields();
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [modalOpen, editingRole, form]);

  // ---------- save ----------
  async function handleSave() {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingRole) {
        // update
        await updateRole(editingRole.id, {
          name: values.name,
          description: values.description || '',
          status: values.status,
        });
        await updateRoleMenus(editingRole.id, checkedKeys.map(Number));
        message.success('角色已更新');
      } else {
        // create
        const result = await createRole({
          code: values.code,
          name: values.name,
          description: values.description || '',
          status: values.status || 'ACTIVE',
        });
        // also assign menus to the new role
        if (checkedKeys.length > 0) {
          await updateRoleMenus(result.id, checkedKeys.map(Number));
        }
        message.success('角色已创建');
      }

      closeModal();
      await loadRoles();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  }

  // ---------- delete ----------
  async function handleDelete(id: number) {
    try {
      await deleteRole(id);
      message.success('角色已删除');
      await loadRoles();
    } catch {
      message.error('删除失败');
    }
  }

  // ---------- columns ----------
  const columns: ProColumns<RoleRow>[] = [
    { title: '角色编码', dataIndex: 'code', copyable: true },
    { title: '角色名称', dataIndex: 'name' },
    { title: '说明', dataIndex: 'description', search: false },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, row) => (
        <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>
          {row.status === 'ACTIVE' ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      ...operationColumnProps<RoleRow>(180),
      render: (_, row) => (
        <span className="table-action-buttons">
          {canUpdate && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => void openEditModal(row)}
            >
              编辑
            </Button>
          )}
          {canDelete && row.code !== 'ADMIN' && (
            <Popconfirm
              title={`确认删除角色「${row.name}」？`}
              onConfirm={() => void handleDelete(row.id)}
              okText="删除"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </span>
      ),
    },
  ];

  // ---------- render ----------
  return (
    <div>
      <ProTable<RoleRow>
        rowKey="id"
        columns={columns}
        search={false}
        dataSource={roles}
        pagination={false}
        loading={loading}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          canCreate && (
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              新建角色
            </Button>
          ),
          <ExportButton key="export" onClick={exportRoles}>
            导出 Excel
          </ExportButton>,
        ]}
      />

      {/* ===== create / edit modal ===== */}
      <Modal
        title={editingRole ? `编辑角色 — ${editingRole.name}` : '新建角色'}
        open={modalOpen}
        onCancel={closeModal}
        width={640}
        destroyOnClose
        footer={
          <Button type="primary" icon={<SaveOutlined />} onClick={() => void handleSave()} loading={saving}>
            保存
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          {/* code field — visible only on create */}
          {!editingRole && (
            <Form.Item
              name="code"
              label="角色编码"
              rules={[
                { required: true, message: '请输入角色编码' },
                { pattern: /^[A-Z][A-Z0-9_]*$/i, message: '大写字母开头，仅含大写字母/数字/下划线' },
              ]}
            >
              <Input placeholder="如 DEPT_MANAGER" />
            </Form.Item>
          )}

          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="如 部门经理" />
          </Form.Item>

          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} placeholder="可选说明" />
          </Form.Item>

          <Form.Item name="status" label="状态" initialValue="ACTIVE">
            <Select>
              <Select.Option value="ACTIVE">启用</Select.Option>
              <Select.Option value="DISABLED">禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14 }}>权限配置</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            勾选需要授予的菜单/权限
          </Text>
        </div>

        <div style={{ maxHeight: 370, overflow: 'auto', border: '1px solid #eaecf0', borderRadius: 6, padding: '6px 0' }}>
          {allMenus.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
          ) : (
            <Tree
              checkable
              defaultExpandAll
              treeData={menuTree}
              checkedKeys={checkedKeys}
              onCheck={(checked) => {
                const keys = Array.isArray(checked) ? checked : checked.checked;
                setCheckedKeys(keys as string[]);
              }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

/* keep route lazy-load happy */
export default RoleListPage;
