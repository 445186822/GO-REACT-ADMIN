import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  HolderOutlined,
  ApartmentOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import { App, Button, Card, Col, Row, Space, Tag, Tabs, Tree, Typography, type TreeDataNode} from 'antd';
import { message } from '../../../utils/message';
import { useRef, useState, useEffect } from 'react';
import {
  createDictType,
  deleteDictType,
  listDictTypes,
  updateDictType,
  listDictItems,
  createDictItem,
  deleteDictItem,
  updateDictItem,
  treeDictTypes,
  batchSortDictItems,
  type DictTypeRow,
  type DictTypeForm,
  type DictItemRow,
  type DictItemForm,
} from '../../../api/dataDict';
import { Permission } from '../../../components/Permission';
import { operationColumnProps } from '../../../utils/tableColumns';

const { Text } = Typography;

export function DataDictPage() {
  const { modal } = App.useApp();
  const typeActionRef = useRef<ActionType>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<DictTypeRow | null>(null);
  const [selectedType, setSelectedType] = useState<DictTypeRow | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DictItemRow | null>(null);
  const [items, setItems] = useState<DictItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'tree'>('table');
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [treeReload, setTreeReload] = useState(0);

  // --- Dict Types ---

  const typeColumns: ProColumns<DictTypeRow>[] = [
    { title: '编码', dataIndex: 'code', width: 180 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '排序', dataIndex: 'sort_order', width: 80, search: false },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      valueType: 'select',
      valueEnum: { ENABLED: { text: '启用', status: 'Success' }, DISABLED: { text: '停用', status: 'Default' } },
      render: (_, row) => (
        <Tag color={row.status === 'ENABLED' ? 'green' : 'default'}>
          {row.status === 'ENABLED' ? '启用' : '停用'}
        </Tag>
      ),
    },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    {
      title: '操作',
      ...operationColumnProps<DictTypeRow>(240),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Button type="link" size="small" onClick={() => selectType(row)}>
            字典项
          </Button>
          <Permission code="datadict:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openTypeEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="datadict:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDeleteType(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function openTypeEdit(row: DictTypeRow) {
    setEditingType(row);
    setTypeOpen(true);
  }

  function confirmDeleteType(row: DictTypeRow) {
    modal.confirm({
      title: `确定删除字典类型「${row.name}」吗？`,
      content: '删除后该类型下的所有字典项也会被删除。',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDictType(row.id);
          message.success('已删除');
          typeActionRef.current?.reload();
          setTreeReload((n) => n + 1);
          if (selectedType?.id === row.id) {
            setSelectedType(null);
            setItems([]);
          }
        } catch {
          message.error('删除字典类型失败，请稍后重试');
        }
      },
    });
  }

  async function selectType(row: DictTypeRow) {
    setSelectedType(row);
    loadItems(row.id);
  }

  // --- Dict Items ---

  async function loadItems(typeId: number) {
    setItemsLoading(true);
    try {
      const data = await listDictItems(typeId);
      setItems(data);
    } catch {
      message.error('加载字典项失败');
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }

  const itemColumns: ProColumns<DictItemRow>[] = [
    { title: '显示名称', dataIndex: 'label', width: 140 },
    { title: '值', dataIndex: 'value', width: 120, copyable: true },
    { title: '排序', dataIndex: 'sort_order', width: 70 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (_, row) => (
        <Tag color={row.status === 'ENABLED' ? 'green' : 'default'}>
          {row.status === 'ENABLED' ? '启用' : '停用'}
        </Tag>
      ),
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '操作',
      ...operationColumnProps<DictItemRow>(180),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="datadict:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openItemEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="datadict:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDeleteItem(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function openItemEdit(row: DictItemRow) {
    setEditingItem(row);
    setItemOpen(true);
  }

  function confirmDeleteItem(row: DictItemRow) {
    modal.confirm({
      title: `确定删除字典项「${row.label}」吗？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDictItem(row.id);
          message.success('已删除');
          if (selectedType) loadItems(selectedType.id);
        } catch {
          message.error('删除字典项失败，请稍后重试');
        }
      },
    });
  }

  // --- Tree View ---

  useEffect(() => {
    if (viewMode === 'tree') {
      treeDictTypes()
        .then((types) => {
          const nodes: TreeDataNode[] = types.map((t) => ({
          key: `type-${t.id}`,
          title: (
            <Space>
              <Tag color="blue">{t.code}</Tag>
              <Text strong>{t.name}</Text>
            </Space>
          ),
          children: t.children.map((c) => ({
            key: `item-${c.id}`,
            title: (
              <Space>
                <Text>{c.label}</Text>
                <Text type="secondary">({c.value})</Text>
                <Tag color={c.status === 'ENABLED' ? 'green' : 'default'} style={{ fontSize: 10 }}>
                  {c.status === 'ENABLED' ? '启用' : '停用'}
                </Tag>
              </Space>
            ),
            isLeaf: true,
          })),
        }));
        setTreeData(nodes);
      })
        .catch(() => {
          message.error('加载字典树失败');
        });
    }
  }, [viewMode, treeReload]);

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Row gutter={16}>
        <Col span={viewMode === 'table' ? 14 : 24}>
          <Card
            title={
              <Space>
                <Text strong>字典类型</Text>
                <Tabs
                  activeKey={viewMode}
                  onChange={(k) => setViewMode(k as 'table' | 'tree')}
                  size="small"
                  style={{ marginBottom: -16 }}
                  items={[
                    { key: 'table', label: <Space size={4}><UnorderedListOutlined />列表</Space> },
                    { key: 'tree', label: <Space size={4}><ApartmentOutlined />树形</Space> },
                  ]}
                />
              </Space>
            }
            extra={
              <Permission code="datadict:create">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingType(null); setTypeOpen(true); }}>
                  新增类型
                </Button>
              </Permission>
            }
          >
            {viewMode === 'table' ? (
              <ProTable<DictTypeRow>
                actionRef={typeActionRef}
                columns={typeColumns}
                request={async (params) => {
                  try {
                    const res = await listDictTypes({
                      keyword: typeof params.name === 'string' ? params.name : (params.code && typeof params.code === 'string' ? params.code : undefined),
                      page: params.current,
                      page_size: params.pageSize,
                    });
                    return { data: res.items, total: res.total, success: true };
                  } catch {
                    message.error('加载字典类型失败');
                    return { data: [], total: 0, success: false };
                  }
                }}
                rowKey="id"
                search={{ labelWidth: 'auto' }}
                options={{ reload: true, density: false }}
                pagination={{ defaultPageSize: 10 }}
                scroll={{ x: 'max-content' }}
                onRow={(row) => ({
                  onClick: () => selectType(row),
                  style: {
                    cursor: 'pointer',
                    background: selectedType?.id === row.id ? '#e6f4ff' : undefined,
                  },
                })}
              />
            ) : (
              <Tree
                treeData={treeData}
                showLine={{ showLeafIcon: false }}
                defaultExpandAll
                style={{ padding: 8 }}
              />
            )}
          </Card>
        </Col>

        {viewMode === 'table' && selectedType && (
          <Col span={10}>
            <Card
              title={
                <Space>
                  <Text strong>字典项</Text>
                  <Tag color="blue">{selectedType.code}</Tag>
                  <Text type="secondary">{selectedType.name}</Text>
                </Space>
              }
              extra={
                <Permission code="datadict:create">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => { setEditingItem(null); setItemOpen(true); }}
                  >
                    新增项
                  </Button>
                </Permission>
              }
            >
              <ProTable<DictItemRow>
                columns={itemColumns}
                dataSource={items}
                loading={itemsLoading}
                rowKey="id"
                search={false}
                options={false}
                pagination={false}
                scroll={{ x: 'max-content', y: 400 }}
              />
            </Card>
          </Col>
        )}

        {viewMode === 'table' && !selectedType && (
          <Col span={10}>
            <Card>
              <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                <HolderOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>选择左侧字典类型以查看字典项</div>
              </div>
            </Card>
          </Col>
        )}
      </Row>

      {/* Type Form Modal */}
      <ModalForm<DictTypeForm>
        title={editingType ? '编辑字典类型' : '新增字典类型'}
        open={typeOpen}
        onOpenChange={setTypeOpen}
        initialValues={
          editingType
            ? { code: editingType.code, name: editingType.name, status: editingType.status, remark: editingType.remark ?? '', sort_order: editingType.sort_order }
            : { status: 'ENABLED', sort_order: 0 }
        }
        onFinish={async (values) => {
          try {
            if (editingType) {
              await updateDictType(editingType.id, values);
            } else {
              await createDictType(values);
            }
            message.success(editingType ? '已更新' : '已创建');
            typeActionRef.current?.reload();
            setTreeReload((n) => n + 1);
            return true;
          } catch {
            message.error('保存字典类型失败，请稍后重试');
            return false;
          }
        }}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="code" label="编码" rules={[{ required: true }]} disabled={!!editingType} />
        <ProFormText name="name" label="名称" rules={[{ required: true }]} />
        <ProFormDigit name="sort_order" label="排序" min={0} max={9999} />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 'ENABLED' },
            { label: '停用', value: 'DISABLED' },
          ]}
        />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>

      {/* Item Form Modal */}
      <ModalForm<DictItemForm>
        title={editingItem ? '编辑字典项' : '新增字典项'}
        open={itemOpen}
        onOpenChange={setItemOpen}
        initialValues={
          editingItem
            ? { label: editingItem.label, value: editingItem.value, status: editingItem.status, remark: editingItem.remark ?? '', sort_order: editingItem.sort_order }
            : { status: 'ENABLED', sort_order: items.length + 1 }
        }
        onFinish={async (values) => {
          try {
            if (editingItem) {
              await updateDictItem(editingItem.id, values);
            } else if (selectedType) {
              await createDictItem(selectedType.id, values);
            }
            message.success(editingItem ? '已更新' : '已创建');
            if (selectedType) loadItems(selectedType.id);
            return true;
          } catch {
            message.error('保存字典项失败，请稍后重试');
            return false;
          }
        }}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="label" label="显示名称" rules={[{ required: true }]} />
        <ProFormText name="value" label="值" rules={[{ required: true }]} />
        <ProFormDigit name="sort_order" label="排序" min={0} max={9999} />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 'ENABLED' },
            { label: '停用', value: 'DISABLED' },
          ]}
        />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>
    </div>
  );
}
