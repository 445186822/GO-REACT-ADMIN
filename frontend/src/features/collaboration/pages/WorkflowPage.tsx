import {
  ApiOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  HistoryOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import { App, Button, Card, Drawer, Empty, Form, Input, Select, Space, Tabs, Tag, Tooltip, Typography} from 'antd';
import { message } from '../../../utils/message';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflowInstances,
  listWorkflows,
  runWorkflow,
  updateWorkflow,
  type WorkflowInstanceRow,
  type WorkflowRow,
} from '../../../api/collaboration';
import { Permission } from '../../../components/Permission';
import { operationColumnProps } from '../../../utils/tableColumns';

const { Text } = Typography;

type WorkflowNodeData = Record<string, unknown> & {
  key: string;
  name: string;
  nodeType: string;
  description?: string;
  assignee?: string;
  config?: Record<string, unknown>;
};

type WorkflowFlowNode = Node<WorkflowNodeData, 'workflowNode'>;
type WorkflowFlowEdge = Edge<{ label?: string }>;

type WorkflowDefinition = Record<string, unknown> & {
  nodes?: WorkflowFlowNode[];
  edges?: WorkflowFlowEdge[];
};

type WorkflowForm = Omit<Partial<WorkflowRow>, 'definition'> & { definition_text?: string };

const NODE_TYPE_CONFIG: Record<string, { color: string; icon: ReactNode; label: string; defaultName: string }> = {
  start: { color: '#52c41a', icon: <PlayCircleOutlined />, label: '开始', defaultName: '开始' },
  approval: { color: '#1890ff', icon: <CheckCircleOutlined />, label: '审批', defaultName: '审批节点' },
  condition: { color: '#faad14', icon: <BranchesOutlined />, label: '条件', defaultName: '条件判断' },
  parallel: { color: '#722ed1', icon: <NodeIndexOutlined />, label: '并行', defaultName: '并行处理' },
  notification: { color: '#13c2c2', icon: <MessageOutlined />, label: '通知', defaultName: '发送通知' },
  timer: { color: '#eb2f96', icon: <ClockCircleOutlined />, label: '定时', defaultName: '定时等待' },
  action: { color: '#fa8c16', icon: <ThunderboltOutlined />, label: '动作', defaultName: '执行动作' },
  data_op: { color: '#2f54eb', icon: <DatabaseOutlined />, label: '数据', defaultName: '数据操作' },
  end: { color: '#ff4d4f', icon: <StopOutlined />, label: '结束', defaultName: '结束' },
};

const NODE_TYPE_OPTIONS = Object.entries(NODE_TYPE_CONFIG).map(([value, item]) => ({
  value,
  label: item.label,
}));

const nodeTypes = { workflowNode: memo(WorkflowGraphNode) };

export function WorkflowPage() {
  const { modal } = App.useApp();
  const workflowRef = useRef<ActionType>(null);
  const instanceRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkflowRow | null>(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRow | null>(null);
  const [designerDefinition, setDesignerDefinition] = useState<WorkflowDefinition>({});
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowFlowEdge>([]);
  const [activeNodeId, setActiveNodeId] = useState('');
  const [activeEdgeId, setActiveEdgeId] = useState('');

  const activeNode = useMemo(() => nodes.find((item) => item.id === activeNodeId) ?? null, [activeNodeId, nodes]);
  const activeEdge = useMemo(() => edges.find((item) => item.id === activeEdgeId) ?? null, [activeEdgeId, edges]);
  const nodeTargetOptions = useMemo(
    () => nodes.map((node) => ({ value: String(node.data.key || node.id), label: String(node.data.name || node.id) })),
    [nodes],
  );

  const workflowColumns: ProColumns<WorkflowRow>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 220,
      render: (_, row) => (
        <Space>
          <ApiOutlined style={{ color: '#1677ff' }} />
          <a onClick={() => openDesigner(row)}>{row.name}</a>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 110,
      render: (_, row) => <Tag color="blue">{row.category}</Tag>,
    },
    { title: '说明', dataIndex: 'description', ellipsis: true, search: false, width: 200 },
    {
      title: '节点/连线',
      width: 110,
      search: false,
      render: (_, row) => {
        const definition = normalizeDefinition(row.definition);
        return <Text>{definition.nodes?.length ?? 0} / {definition.edges?.length ?? 0}</Text>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, row) => (
        <Tag color={row.status === 'ACTIVE' ? 'green' : row.status === 'DRAFT' ? 'gold' : 'default'}>
          {row.status === 'ACTIVE' ? '启用' : row.status === 'DRAFT' ? '草稿' : row.status}
        </Tag>
      ),
    },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime', width: 170, search: false },
    {
      title: '操作',
      ...operationColumnProps<WorkflowRow>(320),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="workflow:update">
            <Button type="link" size="small" icon={<ExpandOutlined />} onClick={() => openDesigner(row)}>
              编排
            </Button>
          </Permission>
          <Permission code="workflow:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="workflow:run">
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => run(row)}>
              运行
            </Button>
          </Permission>
          <Permission code="workflow:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  const instanceColumns: ProColumns<WorkflowInstanceRow>[] = [
    { title: '标题', dataIndex: 'title', width: 220 },
    {
      title: '工作流',
      dataIndex: 'definition_name',
      width: 160,
      search: false,
      render: (_, row) => <Tag>{row.definition_name}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (_, row) => {
        const config: Record<string, { color: string; icon: ReactNode }> = {
          RUNNING: { color: 'processing', icon: <ClockCircleOutlined /> },
          COMPLETED: { color: 'success', icon: <CheckCircleOutlined /> },
          FAILED: { color: 'error', icon: <StopOutlined /> },
          SUSPENDED: { color: 'warning', icon: <PauseCircleOutlined /> },
        };
        const c = config[row.status] || config.RUNNING;
        return (
          <Tag color={c.color} icon={c.icon}>
            {row.status}
          </Tag>
        );
      },
    },
    { title: '开始时间', dataIndex: 'started_at', valueType: 'dateTime', width: 170, search: false },
    { title: '结束时间', dataIndex: 'ended_at', valueType: 'dateTime', width: 170, search: false },
  ];

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((currentEdges) => {
        const exists = currentEdges.some((edge) => edge.source === connection.source && edge.target === connection.target);
        if (exists) {
          message.info('这条连线已存在');
          return currentEdges;
        }
        return addEdge(
          {
            ...connection,
            id: uniqueEdgeId(connection.source!, connection.target!, currentEdges),
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          currentEdges,
        );
      });
    },
    [setEdges],
  );

  function openEdit(row: WorkflowRow) {
    setEditing(row);
    setOpen(true);
  }

  function openDesigner(row: WorkflowRow) {
    const definition = normalizeDefinition(row.definition);
    setSelectedWorkflow(row);
    setDesignerDefinition(definition);
    setNodes(definition.nodes ?? []);
    setEdges(definition.edges ?? []);
    setActiveNodeId(definition.nodes?.[0]?.id ?? '');
    setActiveEdgeId('');
    setDesignerOpen(true);
  }

  async function run(row: WorkflowRow) {
    await runWorkflow(row.id, { title: `${row.name} - ${new Date().toLocaleString()}`, input: {} });
    message.success('工作流已触发运行');
    instanceRef.current?.reload();
  }

  function confirmDelete(row: WorkflowRow) {
    modal.confirm({
      title: `确定删除工作流「${row.name}」吗？`,
      content: '删除后该工作流定义将进入软删除状态，不会再出现在工作流列表中。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteWorkflow(row.id);
        message.success('工作流已删除');
        workflowRef.current?.reload();
      },
    });
  }

  async function submit(values: WorkflowForm) {
    const payload = { ...values, definition: parseJSON(values.definition_text || '{}') };
    delete payload.definition_text;
    if (editing) {
      await updateWorkflow(editing.id, payload);
    } else {
      await createWorkflow(payload);
    }
    message.success('工作流已保存');
    setOpen(false);
    setEditing(null);
    workflowRef.current?.reload();
    return true;
  }

  function addNodeByType(nodeType: string) {
    const config = NODE_TYPE_CONFIG[nodeType] ?? NODE_TYPE_CONFIG.action;
    const id = uniqueNodeId(nodeType, nodes);
    const node: WorkflowFlowNode = {
      id,
      type: 'workflowNode',
      position: nextNodePosition(nodes),
      data: {
        key: id,
        name: config.defaultName,
        nodeType,
      },
    };
    setNodes((prev) => [...prev, node]);
    setActiveNodeId(id);
    setActiveEdgeId('');
  }

  function duplicateNode(node: WorkflowFlowNode) {
    const nodeType = node.data.nodeType || 'action';
    const id = uniqueNodeId(nodeType, nodes);
    setNodes((prev) => [
      ...prev,
      {
        ...node,
        id,
        selected: false,
        position: { x: node.position.x + 48, y: node.position.y + 48 },
        data: {
          ...node.data,
          key: id,
          name: `${node.data.name || '节点'} 副本`,
        },
      },
    ]);
    setActiveNodeId(id);
    setActiveEdgeId('');
  }

  function removeNode(id: string) {
    setNodes((prev) => prev.filter((node) => node.id !== id));
    setEdges((prev) => prev.filter((edge) => edge.source !== id && edge.target !== id));
    if (activeNodeId === id) setActiveNodeId('');
  }

  function removeEdge(id: string) {
    setEdges((prev) => prev.filter((edge) => edge.id !== id));
    if (activeEdgeId === id) setActiveEdgeId('');
  }

  function updateActiveNodeData(patch: Partial<WorkflowNodeData>) {
    if (!activeNode) return;
    const currentId = activeNode.id;
    const nextKey = typeof patch.key === 'string' ? patch.key.trim() : '';
    if (nextKey && nextKey !== currentId) {
      if (nodes.some((node) => node.id === nextKey)) {
        message.warning('节点标识不能重复');
        return;
      }
      setNodes((prev) =>
        prev.map((node) =>
          node.id === currentId
            ? {
                ...node,
                id: nextKey,
                data: { ...node.data, ...patch, key: nextKey },
              }
            : node,
        ),
      );
      setEdges((prev) =>
        prev.map((edge) => ({
          ...edge,
          id: edge.id.replace(currentId, nextKey),
          source: edge.source === currentId ? nextKey : edge.source,
          target: edge.target === currentId ? nextKey : edge.target,
        })),
      );
      setActiveNodeId(nextKey);
      return;
    }
    setNodes((prev) => prev.map((node) => (node.id === currentId ? { ...node, data: { ...node.data, ...patch } } : node)));
  }

  function updateActiveNodeConfig(patch: Record<string, unknown>) {
    if (!activeNode) return;
    updateActiveNodeData({ config: { ...(activeNode.data.config ?? {}), ...patch } });
  }

  function updateApprovalAction(code: 'APPROVE' | 'REJECT', patch: Record<string, unknown>) {
    if (!activeNode) return;
    const config = activeNode.data.config ?? {};
    const actions = normalizeApprovalActions(config.actions);
    const nextActions = actions.map((action) => (action.code === code ? { ...action, ...patch } : action));
    updateActiveNodeConfig({ actions: nextActions });
  }

  function updateActiveEdge(patch: Partial<WorkflowFlowEdge>) {
    if (!activeEdge) return;
    setEdges((prev) => prev.map((edge) => (edge.id === activeEdge.id ? { ...edge, ...patch } : edge)));
  }

  async function saveDesigner(nextStatus?: string) {
    if (!selectedWorkflow) return;
    if (nodes.length === 0) {
      message.warning('请至少添加一个流程节点');
      return;
    }
    const definition: WorkflowDefinition = {
      ...designerDefinition,
      nodes: nodes.map(toPersistedNode),
      edges: edges.map(toPersistedEdge),
    };
    const payload = {
      name: selectedWorkflow.name,
      category: selectedWorkflow.category,
      description: selectedWorkflow.description,
      definition,
      status: nextStatus ?? selectedWorkflow.status,
      biz_type: selectedWorkflow.biz_type,
      adapter_code: selectedWorkflow.adapter_code,
      status_dict_code: selectedWorkflow.status_dict_code,
    };
    await updateWorkflow(selectedWorkflow.id, payload);
    const updated = { ...selectedWorkflow, definition, status: payload.status };
    setSelectedWorkflow(updated);
    setDesignerDefinition(definition);
    workflowRef.current?.reload();
    message.success(nextStatus === 'ACTIVE' ? '工作流已保存并发布' : '编排已保存');
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <Tabs
        defaultActiveKey="definitions"
        tabBarExtraContent={
          <Permission code="workflow:update">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>
              新增工作流
            </Button>
          </Permission>
        }
        items={[
          {
            key: 'definitions',
            label: <Space><BranchesOutlined />工作流定义</Space>,
            children: (
              <ProTable<WorkflowRow>
                actionRef={workflowRef}
                rowKey="id"
                columns={workflowColumns}
                scroll={{ x: 'max-content' }}
                request={async (params) => {
                  const data = await listWorkflows({
                    keyword: typeof params.name === 'string' ? params.name : undefined,
                    category: typeof params.category === 'string' ? params.category : undefined,
                    status: typeof params.status === 'string' ? params.status : undefined,
                  });
                  return {
                    data,
                    success: true,
                  };
                }}
                search={{ labelWidth: 'auto', defaultCollapsed: true }}
                options={{ reload: true, density: true }}
              />
            ),
          },
          {
            key: 'instances',
            label: <Space><HistoryOutlined />运行实例</Space>,
            children: (
              <ProTable<WorkflowInstanceRow>
                actionRef={instanceRef}
                rowKey="id"
                columns={instanceColumns}
                request={async () => ({ data: await listWorkflowInstances(), success: true })}
                search={false}
                options={{ reload: true }}
              />
            ),
          },
        ]}
      />

      <Drawer
        className="workflow-flow-drawer"
        title={
          <Space>
            <BranchesOutlined />
            <span>工作流可视化编排 - {selectedWorkflow?.name}</span>
          </Space>
        }
        open={designerOpen}
        onClose={() => setDesignerOpen(false)}
        width="100vw"
        footer={
          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
            <Text type="secondary">拖动节点自由排布；从节点连接点拖拽到另一个节点即可画箭头</Text>
            <Space>
              <Button onClick={() => setDesignerOpen(false)}>关闭</Button>
              <Permission code="workflow:update">
                <Button icon={<SaveOutlined />} onClick={() => saveDesigner()}>保存</Button>
              </Permission>
              <Permission code="workflow:update">
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => saveDesigner('ACTIVE')}>保存并发布</Button>
              </Permission>
            </Space>
          </Space>
        }
      >
        <div className="workflow-flow-designer">
          <Card size="small" title="节点类型" className="workflow-flow-sidebar">
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(NODE_TYPE_CONFIG).map(([nodeType, item]) => (
                <Button key={nodeType} block icon={item.icon} onClick={() => addNodeByType(nodeType)}>
                  {item.label}
                </Button>
              ))}
            </Space>
          </Card>

          <div className="workflow-flow-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={(_, node) => {
                setActiveNodeId(node.id);
                setActiveEdgeId('');
              }}
              onEdgeClick={(_, edge) => {
                setActiveEdgeId(edge.id);
                setActiveNodeId('');
              }}
              onPaneClick={() => {
                setActiveNodeId('');
                setActiveEdgeId('');
              }}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
              deleteKeyCode={['Backspace', 'Delete']}
              multiSelectionKeyCode={['Meta', 'Control']}
              selectionKeyCode={['Shift']}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => NODE_TYPE_CONFIG[node.data?.nodeType as string]?.color ?? '#1677ff'}
                style={{ borderRadius: 6, overflow: 'hidden' }}
              />
              <Panel position="top-left" className="workflow-flow-panel">
                <Space>
                  <Tag color="blue">节点 {nodes.length}</Tag>
                  <Tag color="purple">连线 {edges.length}</Tag>
                </Space>
              </Panel>
            </ReactFlow>
          </div>

          <Card size="small" title={activeEdge ? '连线属性' : '节点属性'} className="workflow-flow-sidebar">
            {activeEdge ? (
              <Form layout="vertical">
                <Form.Item label="来源节点">
                  <Select
                    value={activeEdge.source}
                    options={nodes.map((node) => ({ value: node.id, label: String(node.data.name || node.id) }))}
                    onChange={(source) => updateActiveEdge({ source })}
                  />
                </Form.Item>
                <Form.Item label="目标节点">
                  <Select
                    value={activeEdge.target}
                    options={nodes.map((node) => ({ value: node.id, label: String(node.data.name || node.id) }))}
                    onChange={(target) => updateActiveEdge({ target })}
                  />
                </Form.Item>
                <Form.Item label="连线标签">
                  <Input value={String(activeEdge.label ?? '')} placeholder="如：通过 / 拒绝" onChange={(event) => updateActiveEdge({ label: event.target.value })} />
                </Form.Item>
                <Button danger icon={<DeleteOutlined />} onClick={() => removeEdge(activeEdge.id)}>
                  删除连线
                </Button>
              </Form>
            ) : activeNode ? (
              <Form layout="vertical">
                <Form.Item label="节点名称">
                  <Input value={activeNode.data.name} onChange={(event) => updateActiveNodeData({ name: event.target.value })} />
                </Form.Item>
                <Form.Item label="节点标识">
                  <Input value={activeNode.data.key} onChange={(event) => updateActiveNodeData({ key: event.target.value })} />
                </Form.Item>
                <Form.Item label="节点类型">
                  <Select value={activeNode.data.nodeType} options={NODE_TYPE_OPTIONS} onChange={(nodeType) => updateActiveNodeData({ nodeType })} />
                </Form.Item>
                <Form.Item label="处理人">
                  <Input
                    value={activeNode.data.assignee}
                    placeholder="如：部门负责人"
                    onChange={(event) => updateActiveNodeData({ assignee: event.target.value })}
                  />
                </Form.Item>
                <Form.Item label="说明">
                  <Input.TextArea
                    value={activeNode.data.description}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    onChange={(event) => updateActiveNodeData({ description: event.target.value })}
                  />
                </Form.Item>
                <WorkflowNodeConfigPanel
                  node={activeNode}
                  targetOptions={nodeTargetOptions}
                  onConfigChange={updateActiveNodeConfig}
                  onApprovalActionChange={updateApprovalAction}
                />
                <Space>
                  <Button icon={<CopyOutlined />} onClick={() => duplicateNode(activeNode)}>复制</Button>
                  <Button danger icon={<DeleteOutlined />} onClick={() => removeNode(activeNode.id)}>删除</Button>
                </Space>
              </Form>
            ) : (
              <Empty description="请选择节点或连线" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </div>
      </Drawer>

      <ModalForm<WorkflowForm>
        title={editing ? '编辑工作流' : '新增工作流'}
        open={open}
        width={640}
        modalProps={{ destroyOnHidden: true, onCancel: () => { setOpen(false); setEditing(null); } }}
        initialValues={
          editing
            ? { ...editing, definition_text: JSON.stringify(editing.definition ?? {}, null, 2) }
            : {
                category: 'general',
                status: 'ACTIVE',
                definition_text: JSON.stringify(defaultWorkflowDefinition(), null, 2),
              }
        }
        onFinish={submit}
      >
        <ProFormText name="name" label="工作流名称" rules={[{ required: true }]} placeholder="如：请假审批流程" />
        <ProFormSelect
          name="category"
          label="分类"
          options={[
            { label: '通用流程', value: 'general' },
            { label: '审批流程', value: 'approval' },
            { label: '数据处理', value: 'data' },
            { label: '通知推送', value: 'notification' },
          ]}
        />
        <ProFormTextArea name="description" label="说明" placeholder="描述此工作流的用途" />
        <ProFormText name="biz_type" label="业务类型" placeholder="如：customer / expense_claim" />
        <ProFormText name="adapter_code" label="业务适配器" placeholder="如：biz_customer；为空则只保存审批实例业务状态" />
        <ProFormText name="status_dict_code" label="业务状态字典" placeholder="如：CUSTOMER_APPROVAL_STATUS" />
        <ProFormTextArea
          name="definition_text"
          label="流程定义 (JSON)"
          fieldProps={{ rows: 8 }}
          placeholder='{"nodes":[{"id":"start","type":"workflowNode","position":{"x":100,"y":240},"data":{"key":"start","name":"开始","nodeType":"start"}}],"edges":[]}'
        />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '启用', value: 'ACTIVE' },
            { label: '草稿', value: 'DRAFT' },
            { label: '归档', value: 'ARCHIVED' },
          ]}
        />
        <div style={{ marginTop: 8, padding: 12, background: '#fafafa', borderRadius: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            使用 React Flow 编排结构：nodes 保存节点位置和属性，edges 保存 source/target 箭头连线。
          </Text>
        </div>
      </ModalForm>
    </div>
  );
}

function WorkflowGraphNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const config = NODE_TYPE_CONFIG[data.nodeType] ?? NODE_TYPE_CONFIG.action;
  return (
    <div className={`workflow-flow-node${selected ? ' workflow-flow-node-selected' : ''}`} style={{ borderLeftColor: config.color }}>
      <Handle type="target" position={Position.Left} className="workflow-flow-handle" />
      <div className="workflow-flow-node-header">
        <Tag color={config.color} icon={config.icon}>{config.label}</Tag>
        <Text strong ellipsis>{data.name || '未命名节点'}</Text>
      </div>
      <Text type="secondary" className="workflow-flow-node-key">标识：{data.key}</Text>
      {data.assignee ? <Text type="secondary" className="workflow-flow-node-meta">处理人：{data.assignee}</Text> : null}
      {data.description ? <Text type="secondary" className="workflow-flow-node-meta" ellipsis>{data.description}</Text> : null}
      <Handle type="source" position={Position.Right} className="workflow-flow-handle workflow-flow-handle-source" />
    </div>
  );
}

type NodeTargetOption = { value: string; label: string };
type ApprovalActionConfig = {
  code: 'APPROVE' | 'REJECT';
  label: string;
  target?: string;
  instanceStatus?: string;
  businessStatus?: string;
  requireComment?: boolean;
};

function WorkflowNodeConfigPanel({
  node,
  targetOptions,
  onConfigChange,
  onApprovalActionChange,
}: {
  node: WorkflowFlowNode;
  targetOptions: NodeTargetOption[];
  onConfigChange: (patch: Record<string, unknown>) => void;
  onApprovalActionChange: (code: 'APPROVE' | 'REJECT', patch: Record<string, unknown>) => void;
}) {
  const config = node.data.config ?? {};
  const actions = normalizeApprovalActions(config.actions);
  const approve = actions.find((item) => item.code === 'APPROVE') ?? actions[0];
  const reject = actions.find((item) => item.code === 'REJECT') ?? actions[1];
  const conditions = normalizeConditionRules(config.conditions);
  const firstCondition = conditions[0] ?? { expression: '', target: '' };

  if (node.data.nodeType === 'approval') {
    return (
      <>
        <Form.Item label="通过后节点">
          <Select allowClear value={approve.target} options={targetOptions} onChange={(target) => onApprovalActionChange('APPROVE', { target })} />
        </Form.Item>
        <Form.Item label="通过后流程状态">
          <Select
            value={approve.instanceStatus || 'PENDING'}
            options={approvalStatusOptions()}
            onChange={(instanceStatus) => onApprovalActionChange('APPROVE', { instanceStatus })}
          />
        </Form.Item>
        <Form.Item label="通过后业务状态">
          <Input
            value={approve.businessStatus || ''}
            placeholder="如：WAIT_PAY / CUSTOMER_APPROVED"
            onChange={(event) => onApprovalActionChange('APPROVE', { businessStatus: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="驳回后节点">
          <Select allowClear value={reject.target} options={targetOptions} onChange={(target) => onApprovalActionChange('REJECT', { target })} />
        </Form.Item>
        <Form.Item label="驳回后流程状态">
          <Select
            value={reject.instanceStatus || 'REJECTED'}
            options={approvalStatusOptions()}
            onChange={(instanceStatus) => onApprovalActionChange('REJECT', { instanceStatus })}
          />
        </Form.Item>
        <Form.Item label="驳回后业务状态">
          <Input
            value={reject.businessStatus || ''}
            placeholder="如：FINANCE_REJECTED / CUSTOMER_REJECTED"
            onChange={(event) => onApprovalActionChange('REJECT', { businessStatus: event.target.value })}
          />
        </Form.Item>
        <Form.Item label="驳回意见">
          <Select
            value={reject.requireComment ? 'required' : 'optional'}
            options={[
              { value: 'required', label: '必填' },
              { value: 'optional', label: '选填' },
            ]}
            onChange={(value) => onApprovalActionChange('REJECT', { requireComment: value === 'required' })}
          />
        </Form.Item>
      </>
    );
  }

  if (node.data.nodeType === 'condition') {
    return (
      <>
        <Form.Item label="条件表达式">
          <Input
            value={firstCondition.expression}
            placeholder="form.amount > 1000"
            onChange={(event) => onConfigChange({ conditions: [{ ...firstCondition, expression: event.target.value }] })}
          />
        </Form.Item>
        <Form.Item label="满足后节点">
          <Select
            allowClear
            value={firstCondition.target}
            options={targetOptions}
            onChange={(target) => onConfigChange({ conditions: [{ ...firstCondition, target }] })}
          />
        </Form.Item>
        <Form.Item label="默认节点">
          <Select allowClear value={String(config.defaultTarget ?? '') || undefined} options={targetOptions} onChange={(defaultTarget) => onConfigChange({ defaultTarget })} />
        </Form.Item>
      </>
    );
  }

  if (node.data.nodeType === 'end') {
    return (
      <>
        <Form.Item label="最终流程状态">
          <Select value={String(config.finalStatus ?? 'APPROVED')} options={approvalStatusOptions()} onChange={(finalStatus) => onConfigChange({ finalStatus })} />
        </Form.Item>
        <Form.Item label="最终业务状态">
          <Input
            value={String(config.finalBusinessStatus ?? '')}
            placeholder="如：PAID_APPROVED / CUSTOMER_ARCHIVED"
            onChange={(event) => onConfigChange({ finalBusinessStatus: event.target.value })}
          />
        </Form.Item>
      </>
    );
  }

  if (node.data.nodeType === 'notification') {
    return (
      <>
        <Form.Item label="通知模板">
          <Input value={String(config.notificationTemplate ?? '')} onChange={(event) => onConfigChange({ notificationTemplate: event.target.value })} />
        </Form.Item>
        <Form.Item label="接收人">
          <Input value={String(config.notificationRecipient ?? '')} onChange={(event) => onConfigChange({ notificationRecipient: event.target.value })} />
        </Form.Item>
      </>
    );
  }

  if (node.data.nodeType === 'action') {
    return (
      <Form.Item label="后端动作">
        <Input value={String(config.actionName ?? '')} placeholder="create_task / write_log" onChange={(event) => onConfigChange({ actionName: event.target.value })} />
      </Form.Item>
    );
  }

  if (node.data.nodeType === 'timer') {
    return (
      <>
        <Form.Item label="等待时长">
          <Input value={String(config.waitDuration ?? '')} placeholder="2h / 1d" onChange={(event) => onConfigChange({ waitDuration: event.target.value })} />
        </Form.Item>
        <Form.Item label="超时动作">
          <Select
            allowClear
            value={String(config.timeoutAction ?? '') || undefined}
            options={[
              { value: 'APPROVE', label: '自动通过' },
              { value: 'REMIND', label: '提醒' },
            ]}
            onChange={(timeoutAction) => onConfigChange({ timeoutAction })}
          />
        </Form.Item>
      </>
    );
  }

  return null;
}

function normalizeApprovalActions(value: unknown): ApprovalActionConfig[] {
  const defaults: ApprovalActionConfig[] = [
    { code: 'APPROVE', label: '通过', instanceStatus: 'PENDING' },
    { code: 'REJECT', label: '驳回', instanceStatus: 'REJECTED', requireComment: true },
  ];
  if (!Array.isArray(value)) return defaults;
  return defaults.map((item) => ({ ...item, ...(value.find((action) => isActionConfig(action) && action.code === item.code) as Partial<ApprovalActionConfig> | undefined) }));
}

function normalizeConditionRules(value: unknown): Array<{ expression: string; target?: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { expression?: unknown; target?: unknown } => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      expression: typeof item.expression === 'string' ? item.expression : '',
      target: typeof item.target === 'string' ? item.target : undefined,
    }));
}

function isActionConfig(value: unknown): value is ApprovalActionConfig {
  return value !== null && typeof value === 'object' && 'code' in value;
}

function approvalStatusOptions() {
  return [
    { value: 'PENDING', label: '待审批' },
    { value: 'APPROVED', label: '已通过' },
    { value: 'REJECTED', label: '已驳回' },
  ];
}

function normalizeDefinition(value: unknown): WorkflowDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const definition = value as WorkflowDefinition;
  const nodes = Array.isArray(definition.nodes)
    ? definition.nodes.map((node, index) => normalizeNode(node, index)).filter((node): node is WorkflowFlowNode => Boolean(node))
    : [];
  const rawEdges = Array.isArray(definition.edges) ? definition.edges : [];
  const edges = rawEdges.map((edge, index) => normalizeEdge(edge, index)).filter((edge): edge is WorkflowFlowEdge => Boolean(edge));
  const fallbackEdges = edges.length === 0 ? sequentialEdges(nodes) : edges;
  return { ...definition, nodes, edges: fallbackEdges };
}

function normalizeNode(node: unknown, index: number): WorkflowFlowNode | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const item = node as Partial<WorkflowFlowNode> & {
    key?: string;
    name?: string;
    nodeType?: string;
    type?: string;
    description?: string;
    assignee?: string;
    config?: Record<string, unknown>;
  };
  const flowData = item.data as Partial<WorkflowNodeData> | undefined;
  const nodeType = flowData?.nodeType || item.nodeType || item.type || 'action';
  const config = NODE_TYPE_CONFIG[nodeType] ?? NODE_TYPE_CONFIG.action;
  const id = item.id || flowData?.key || item.key || `${nodeType}_${index + 1}`;
  return {
    id,
    type: 'workflowNode',
    position: normalizePosition(item.position, index),
    data: {
      key: flowData?.key || item.key || id,
      name: flowData?.name || item.name || config.defaultName,
      nodeType,
      description: flowData?.description || item.description,
      assignee: flowData?.assignee || item.assignee,
      config: flowData?.config || item.config,
    },
  };
}

function normalizeEdge(edge: unknown, index: number): WorkflowFlowEdge | null {
  if (!edge || typeof edge !== 'object' || Array.isArray(edge)) return null;
  const item = edge as Partial<WorkflowFlowEdge>;
  if (!item.source || !item.target) return null;
  return {
    id: item.id || `edge_${item.source}_${item.target}_${index}`,
    source: item.source,
    target: item.target,
    label: item.label,
    type: item.type || 'smoothstep',
    markerEnd: item.markerEnd || { type: MarkerType.ArrowClosed },
  };
}

function normalizePosition(position: unknown, index: number) {
  if (position && typeof position === 'object' && !Array.isArray(position)) {
    const point = position as { x?: unknown; y?: unknown };
    if (typeof point.x === 'number' && typeof point.y === 'number') {
      return { x: point.x, y: point.y };
    }
  }
  return {
    x: 120 + (index % 3) * 340,
    y: 120 + Math.floor(index / 3) * 180,
  };
}

function sequentialEdges(nodes: WorkflowFlowNode[]): WorkflowFlowEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `edge_${node.id}_${nodes[index + 1].id}`,
    source: node.id,
    target: nodes[index + 1].id,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

function toPersistedNode(node: WorkflowFlowNode): WorkflowFlowNode {
  return {
    id: node.id,
    type: 'workflowNode',
    position: node.position,
    data: {
      key: node.data.key || node.id,
      name: node.data.name,
      nodeType: node.data.nodeType,
      description: node.data.description,
      assignee: node.data.assignee,
      config: node.data.config,
    },
  };
}

function toPersistedEdge(edge: WorkflowFlowEdge): WorkflowFlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: edge.type || 'smoothstep',
    markerEnd: edge.markerEnd || { type: MarkerType.ArrowClosed },
  };
}

function uniqueNodeId(nodeType: string, nodes: WorkflowFlowNode[]) {
  const prefix = nodeType.replace(/[^a-zA-Z0-9_]/g, '') || 'node';
  let index = nodes.length + 1;
  let id = `${prefix}_${index}`;
  while (nodes.some((node) => node.id === id)) {
    index += 1;
    id = `${prefix}_${index}`;
  }
  return id;
}

function uniqueEdgeId(source: string, target: string, edges: WorkflowFlowEdge[]) {
  let index = edges.length + 1;
  let id = `edge_${source}_${target}`;
  while (edges.some((edge) => edge.id === id)) {
    index += 1;
    id = `edge_${source}_${target}_${index}`;
  }
  return id;
}

function nextNodePosition(nodes: WorkflowFlowNode[]) {
  return {
    x: 120 + (nodes.length % 4) * 300,
    y: 120 + Math.floor(nodes.length / 4) * 180,
  };
}

function defaultWorkflowDefinition(): WorkflowDefinition {
  const nodes: WorkflowFlowNode[] = [
    {
      id: 'start',
      type: 'workflowNode',
      position: { x: 100, y: 240 },
      data: { key: 'start', name: '开始', nodeType: 'start' },
    },
    {
      id: 'approval_1',
      type: 'workflowNode',
      position: { x: 460, y: 240 },
      data: { key: 'approval_1', name: '部门审批', nodeType: 'approval', assignee: '部门负责人' },
    },
    {
      id: 'end',
      type: 'workflowNode',
      position: { x: 820, y: 240 },
      data: { key: 'end', name: '结束', nodeType: 'end' },
    },
  ];
  return {
    nodes,
    edges: sequentialEdges(nodes),
  };
}

function parseJSON(value: string) {
  try {
    return normalizeDefinition(JSON.parse(value));
  } catch {
    throw new Error('定义 JSON 格式不正确');
  }
}
