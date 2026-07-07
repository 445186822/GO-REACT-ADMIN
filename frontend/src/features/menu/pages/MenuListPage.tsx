import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import { App, Button, Space, Tag, Typography } from 'antd';
import { useMemo, useRef, useState } from 'react';
import { message } from '../../../utils/message';
import { createMenu, deleteMenu, listMenus, updateMenu, type MenuForm, type MenuRow } from '../../../api/menus';
import { ExportButton } from '../../../components/ExportButton';
import { Permission } from '../../../components/Permission';
import { exportExcel } from '../../../utils/exportExcel';
import { operationColumnProps } from '../../../utils/tableColumns';
import { menuIconOptions, renderMenuIconLabel, renderMenuIconOption } from '../menuIcons';
import { buildMenuTree, menuParentOptions, type MenuTreeRow, typeText } from '../menuView';

export function MenuListPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [flatMenus, setFlatMenus] = useState<MenuRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuRow | null>(null);
  const [formSeed, setFormSeed] = useState<Partial<MenuForm>>({ type: 'page', sort_order: 0 });

  const parentOptions = useMemo(() => menuParentOptions(flatMenus, editing?.id), [flatMenus, editing?.id]);

  const columns: ProColumns<MenuTreeRow>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 240,
      render: (_, row) => (
        <Space size={8}>
          <Typography.Text strong={row.type === 'directory'}>{row.name}</Typography.Text>
          {row.type === 'directory' ? <Tag color="blue">分组</Tag> : null}
        </Space>
      ),
    },
    { title: '权限编码', dataIndex: 'code', copyable: true },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (_, row) => <Tag color={typeColor(row.type)}>{typeText(row.type)}</Tag>,
    },
    { title: '路由', dataIndex: 'path' },
    { title: '组件', dataIndex: 'component', width: 160 },
    { title: '图标', dataIndex: 'icon', width: 220, render: (_, row) => renderMenuIconLabel(row.icon) },
    { title: '排序', dataIndex: 'sort_order', width: 80 },
    {
      title: '操作',
      ...operationColumnProps<MenuTreeRow>(240),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          {row.type !== 'button' ? (
            <Permission code="menu:create">
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreate(row)}>
                子项
              </Button>
            </Permission>
          ) : null}
          <Permission code="menu:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="menu:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function openCreate(parent?: MenuRow) {
    setEditing(null);
    setFormSeed({
      parent_id: parent?.id,
      type: parent ? 'button' : 'page',
      sort_order: parent ? parent.sort_order + 1 : 0,
    });
    setOpen(true);
  }

  function openEdit(row: MenuRow) {
    setEditing(row);
    setFormSeed({
      parent_id: row.parent_id ?? undefined,
      type: row.type,
      code: row.code,
      name: row.name,
      path: row.path ?? undefined,
      component: row.component ?? undefined,
      icon: row.icon ?? undefined,
      sort_order: row.sort_order,
    });
    setOpen(true);
  }

  function confirmDelete(row: MenuRow) {
    modal.confirm({
      title: `删除菜单「${row.name}」?`,
      content: row.type === 'button' ? '删除后对应按钮权限将不可用。' : '如果存在子菜单，后端会拒绝删除以保护树结构。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteMenu(row.id);
        message.success('菜单已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: MenuForm) {
    const payload: MenuForm = {
      ...values,
      parent_id: values.parent_id || null,
      path: values.path || null,
      component: values.component || null,
      icon: values.icon || null,
      sort_order: values.sort_order ?? 0,
    };
    try {
      if (editing) {
        await updateMenu(editing.id, payload);
      } else {
        await createMenu(payload);
      }
      message.success(editing ? '菜单已更新' : '菜单已创建');
      setOpen(false);
      setEditing(null);
      actionRef.current?.reload();
      return true;
    } catch {
      message.error('保存菜单失败，请检查编码是否重复或父级是否合法');
      return false;
    }
  }

  async function exportMenus() {
    const rows = await listMenus();
    await exportExcel<MenuRow>(
      'menus.xlsx',
      'Menus',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '父级 ID', dataIndex: 'parent_id' },
        { title: '名称', dataIndex: 'name' },
        { title: '类型', dataIndex: 'type', render: (_, row) => typeText(row.type) },
        { title: '权限编码', dataIndex: 'code' },
        { title: '路由', dataIndex: 'path' },
        { title: '组件', dataIndex: 'component' },
        { title: '图标', dataIndex: 'icon' },
        { title: '排序', dataIndex: 'sort_order' },
      ],
      rows,
    );
    message.success('菜单 Excel 已生成');
  }

  return (
    <div>
      <ProTable<MenuTreeRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => {
          const rows = await listMenus();
          setFlatMenus(rows);
          return { data: buildMenuTree(rows), success: true };
        }}
        expandable={{ defaultExpandAllRows: true }}
        pagination={false}
        toolBarRender={() => [
          <Permission code="menu:create" key="create">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
              新增菜单
            </Button>
          </Permission>,
          <ExportButton key="export" onClick={exportMenus}>
            导出 Excel
          </ExportButton>,
        ]}
      />

      <ModalForm<MenuForm>
        key={editing ? `edit-${editing.id}` : `create-${formSeed.parent_id ?? 'root'}-${formSeed.type ?? 'page'}`}
        title={editing ? '编辑菜单' : '新增菜单'}
        open={open}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            setOpen(false);
            setEditing(null);
          },
        }}
        initialValues={formSeed}
        onFinish={submit}
      >
        <ProFormSelect
          name="parent_id"
          label="父级菜单"
          options={parentOptions}
          placeholder="不选择则为根菜单"
          fieldProps={{ allowClear: true, showSearch: true, optionFilterProp: 'label' }}
        />
        <ProFormSelect
          name="type"
          label="类型"
          rules={[{ required: true }]}
          options={[
            { label: '目录', value: 'directory' },
            { label: '页面', value: 'page' },
            { label: '按钮', value: 'button' },
          ]}
        />
        <ProFormText name="code" label="权限编码" rules={[{ required: true }]} />
        <ProFormText name="name" label="名称" rules={[{ required: true }]} />
        <ProFormText name="path" label="路由路径" />
        <ProFormText name="component" label="组件标识" />
        <ProFormSelect
          name="icon"
          label="图标"
          options={menuIconOptions}
          placeholder="请选择菜单图标"
          fieldProps={{
            allowClear: true,
            showSearch: true,
            virtual: false,
            listHeight: 360,
            popupClassName: 'menu-icon-select-popup',
            optionFilterProp: 'searchLabel',
            optionRender: (option) => renderMenuIconOption(option.value),
          }}
        />
        <ProFormDigit name="sort_order" label="排序" min={0} max={9999} />
      </ModalForm>
    </div>
  );
}

function typeColor(type: MenuRow['type']) {
  if (type === 'directory') return 'blue';
  if (type === 'page') return 'green';
  return 'purple';
}
