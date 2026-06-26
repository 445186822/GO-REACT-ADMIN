import {
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
  AuditOutlined,
  SendOutlined,
  HistoryOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  ExpandOutlined,
  EditOutlined,
  DeleteOutlined,
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
import {
  Avatar,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Steps,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  actionApproval,
  createApprovalTemplate,
  deleteApprovalTemplate,
  listApprovalInstances,
  listApprovalTemplates,
  listWorkflows,
  submitApproval,
  updateApprovalTemplate,
  type ApprovalInstanceRow,
  type ApprovalTemplateRow,
  type WorkflowRow,
} from '../../../api/collaboration';
import { Permission } from '../../../components/Permission';
import {
  approvalActionLabel,
  buildApprovalActionPayload,
  requiresApprovalComment,
  type ApprovalAction,
} from '../approvalActions';

const { Text, Title } = Typography;

type TemplateForm = Omit<Partial<ApprovalTemplateRow>, 'steps'> & { steps_text?: string };
type SubmitForm = Omit<Partial<ApprovalInstanceRow>, 'form_data'> & { form_data_text?: string };

const STATUS_FLOW: Record<string, { color: string; label: string; next: string[] }> = {
  PENDING: { color: 'processing', label: '待审批', next: ['APPROVED', 'REJECTED'] },
  APPROVED: { color: 'success', label: '已通过', next: [] },
  REJECTED: { color: 'error', label: '已驳回', next: ['PENDING'] },
  WITHDRAWN: { color: 'default', label: '已撤回', next: ['PENDING'] },
};

export function ApprovalCenterPage() {
  const { modal } = App.useApp();
  const templateRef = useRef<ActionType>(null);
  const instanceRef = useRef<ActionType>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApprovalTemplateRow | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<ApprovalInstanceRow | null>(null);
  const [templates, setTemplates] = useState<ApprovalTemplateRow[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [instances, setInstances] = useState<ApprovalInstanceRow[]>([]);
  const [pendingAction, setPendingAction] = useState<{ id: number; action: ApprovalAction } | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    void listApprovalTemplates().then(setTemplates);
    void listWorkflows({ category: 'approval', status: 'ACTIVE' }).then(setWorkflows);
  }, []);

  const templateColumns: ProColumns<ApprovalTemplateRow>[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 200,
      render: (_, row) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <a onClick={() => { setEditingTemplate(row); setTemplateOpen(true); }}>{row.name}</a>
        </Space>
      ),
    },
    {
      title: '业务类型',
      dataIndex: 'biz_type',
      width: 120,
      render: (_, row) => <Tag color="purple">{row.biz_type}</Tag>,
    },
    { title: '说明', dataIndex: 'description', ellipsis: true, search: false },
    {
      title: '步骤数',
      dataIndex: 'steps',
      width: 80,
      search: false,
      render: (_, row) => <Tag>{(row.steps || []).length} 步</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'gold'}>{row.status === 'ACTIVE' ? '启用' : '草稿'}</Tag>,
    },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime', width: 170, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, row) => (
        <Space>
          <Permission code="approval:template:update">
            <Button type="link" size="small" icon={<EditOutlined />}
              onClick={() => { setEditingTemplate(row); setTemplateOpen(true); }}>
              编辑
            </Button>
          </Permission>
          <Permission code="approval:template:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDeleteTemplate(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  const instanceColumns: ProColumns<ApprovalInstanceRow>[] = [
    {
      title: '审批标题',
      dataIndex: 'title',
      width: 220,
      ellipsis: true,
      render: (_, row) => (
        <a onClick={() => { setSelectedInstance(row); setDetailVisible(true); }}>{row.title}</a>
      ),
    },
    {
      title: '业务类型',
      dataIndex: 'biz_type',
      width: 110,
      render: (_, row) => <Tag color="purple">{row.biz_type}</Tag>,
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 110,
      search: false,
      render: (_, row) => <Space size={4}><Avatar size="small" icon={<UserOutlined />} />{row.applicant}</Space>,
    },
    {
      title: '审批状态',
      dataIndex: 'status',
      width: 110,
      render: (_, row) => {
        const cfg = STATUS_FLOW[row.status] || { color: 'default', label: row.status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    { title: '当前步骤', dataIndex: 'current_step', width: 110, search: false },
    { title: '提交时间', dataIndex: 'created_at', valueType: 'dateTime', width: 170, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" icon={<ExpandOutlined />}
            onClick={() => { setSelectedInstance(row); setDetailVisible(true); }}>
            详情
          </Button>
          {row.status === 'PENDING' && (
            <Permission code="approval:action">
              <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }}
                onClick={() => handleAction(row.id, 'APPROVE')}>通过</Button>
              <Button type="link" size="small" icon={<CloseOutlined />} danger
                onClick={() => handleAction(row.id, 'REJECT')}>驳回</Button>
            </Permission>
          )}
        </Space>
      ),
    },
  ];

  function handleAction(id: number, action: ApprovalAction) {
    setPendingAction({ id, action });
    setActionComment('');
  }

  async function submitApprovalAction() {
    if (!pendingAction) return;
    if (requiresApprovalComment(pendingAction.action) && !actionComment.trim()) {
      message.warning('请输入驳回原因');
      return;
    }
    setActionSubmitting(true);
    try {
      await actionApproval(pendingAction.id, buildApprovalActionPayload(pendingAction.action, actionComment));
      message.success(`审批已${approvalActionLabel(pendingAction.action)}`);
      setPendingAction(null);
      setActionComment('');
      instanceRef.current?.reload();
    } finally {
      setActionSubmitting(false);
    }
  }

  function confirmDeleteTemplate(row: ApprovalTemplateRow) {
    modal.confirm({
      title: `确定删除审批模板「${row.name}」吗？`,
      content: '删除后该模板将不再用于新审批，历史审批实例仍会保留。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteApprovalTemplate(row.id);
        message.success('审批模板已删除');
        templateRef.current?.reload();
        void listApprovalTemplates().then(setTemplates);
      },
    });
  }

  async function saveTemplate(values: TemplateForm) {
    const payload = { ...values, steps: parseJSON(values.steps_text || '[]') };
    delete payload.steps_text;
    if (editingTemplate) {
      await updateApprovalTemplate(editingTemplate.id, payload);
    } else {
      await createApprovalTemplate(payload);
    }
    message.success('审批模板已保存');
    setTemplateOpen(false);
    setEditingTemplate(null);
    templateRef.current?.reload();
    void listApprovalTemplates().then(setTemplates);
    return true;
  }

  async function createInstance(values: SubmitForm) {
    const payload = { ...values, form_data: parseJSON(values.form_data_text || '{}') };
    delete payload.form_data_text;
    await submitApproval(payload);
    message.success('审批已提交');
    setSubmitOpen(false);
    instanceRef.current?.reload();
    return true;
  }

  const currentStep = selectedInstance?.current_step || 0;
  const selectedTemplate = selectedInstance?.template_id ? templates.find((item) => item.id === selectedInstance.template_id) : undefined;
  const approvalStepTitles = selectedTemplate ? resolveApprovalStepTitles(selectedTemplate, workflows) : [];

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待审批" value={instances.filter((item) => item.status === 'PENDING').length} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已通过" value={instances.filter((item) => item.status === 'APPROVED').length} prefix={<CheckOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已驳回" value={instances.filter((item) => item.status === 'REJECTED').length} prefix={<CloseOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="审批模板" value={templates.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="instances"
        tabBarExtraContent={
          <Space>
            <Permission code="approval:submit">
              <Button type="primary" icon={<SendOutlined />} onClick={() => setSubmitOpen(true)}>发起审批</Button>
            </Permission>
            <Permission code="approval:template:create">
              <Button icon={<PlusOutlined />} onClick={() => { setEditingTemplate(null); setTemplateOpen(true); }}>新增模板</Button>
            </Permission>
          </Space>
        }
        items={[
          {
            key: 'instances',
            label: <Space><AuditOutlined />审批实例</Space>,
            children: (
              <ProTable<ApprovalInstanceRow>
                actionRef={instanceRef}
                rowKey="id"
                columns={instanceColumns}
                request={async (params) => {
                  const data = await listApprovalInstances({
                    keyword: typeof params.title === 'string' ? params.title : undefined,
                    biz_type: typeof params.biz_type === 'string' ? params.biz_type : undefined,
                    status: typeof params.status === 'string' ? params.status : undefined,
                  });
                  setInstances(data);
                  return { data, success: true };
                }}
                search={{ labelWidth: 'auto', defaultCollapsed: true }}
                options={{ reload: true }}
              />
            ),
          },
          {
            key: 'templates',
            label: <Space><FileTextOutlined />审批模板</Space>,
            children: (
              <ProTable<ApprovalTemplateRow>
                actionRef={templateRef}
                rowKey="id"
                columns={templateColumns}
                request={async (params) => {
                  const data = await listApprovalTemplates({
                    keyword: typeof params.name === 'string' ? params.name : undefined,
                    biz_type: typeof params.biz_type === 'string' ? params.biz_type : undefined,
                    status: typeof params.status === 'string' ? params.status : undefined,
                  });
                  setTemplates(data);
                  return { data, success: true };
                }}
                search={{ labelWidth: 'auto', defaultCollapsed: true }}
                options={{ reload: true }}
              />
            ),
          },
        ]}
      />

      {/* Instance Detail Drawer */}
      <Drawer
        title={<Space><AuditOutlined />审批详情 - {selectedInstance?.title}</Space>}
        open={detailVisible}
        onClose={() => { setDetailVisible(false); setSelectedInstance(null); }}
        width={640}
      >
        {selectedInstance && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="标题">{selectedInstance.title}</Descriptions.Item>
              <Descriptions.Item label="业务类型">
                <Tag color="purple">{selectedInstance.biz_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                <Space><Avatar size="small" icon={<UserOutlined />} />{selectedInstance.applicant}</Space>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_FLOW[selectedInstance.status]?.color}>
                  {STATUS_FLOW[selectedInstance.status]?.label || selectedInstance.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="当前步骤">{selectedInstance.current_step || '-'}</Descriptions.Item>
              <Descriptions.Item label="提交时间">{selectedInstance.created_at}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>审批进度</Title>
            <Steps
              current={currentStep}
              size="small"
              direction="vertical"
              style={{ marginBottom: 24 }}
              items={(approvalStepTitles.length ? approvalStepTitles : ['未配置审批步骤']).map((title, index) => ({
                title,
                description: <Text type="secondary">{approvalStepDescription(selectedInstance.status, currentStep, index)}</Text>,
                status: approvalStepStatus(selectedInstance.status, currentStep, index),
              }))}
            />

            <Title level={5}>审批历史</Title>
            <Timeline
              items={[
                { color: 'green', children: <><Text strong>{selectedInstance.applicant}</Text> 提交了审批 <Text type="secondary">{selectedInstance.created_at}</Text></> },
              ]}
            />
          </>
        )}
      </Drawer>

      <Modal
        title={pendingAction ? `确认${approvalActionLabel(pendingAction.action)}？` : ''}
        open={Boolean(pendingAction)}
        okText={pendingAction ? approvalActionLabel(pendingAction.action) : '确定'}
        okButtonProps={{ danger: pendingAction?.action === 'REJECT' }}
        confirmLoading={actionSubmitting}
        onCancel={() => {
          setPendingAction(null);
          setActionComment('');
        }}
        onOk={submitApprovalAction}
      >
        {pendingAction?.action === 'REJECT' ? (
          <Input.TextArea
            value={actionComment}
            onChange={(event) => setActionComment(event.target.value)}
            placeholder="请输入驳回原因"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        ) : (
          <Text>确认通过当前审批节点？</Text>
        )}
      </Modal>

      {/* Template Form Modal */}
      <ModalForm<TemplateForm>
        title={editingTemplate ? '编辑审批模板' : '新增审批模板'}
        open={templateOpen}
        width={600}
        modalProps={{ destroyOnHidden: true, onCancel: () => { setTemplateOpen(false); setEditingTemplate(null); } }}
        initialValues={
          editingTemplate
            ? { ...editingTemplate, steps_text: JSON.stringify(editingTemplate.steps ?? [], null, 2) }
            : {
                status: 'ACTIVE',
                steps_text: JSON.stringify(
                  [{ name: '部门负责人审批', assignee: '部门负责人' }, { name: '总经理审批', assignee: '总经理' }],
                  null, 2,
                ),
              }
        }
        onFinish={saveTemplate}
      >
        <ProFormText name="name" label="模板名称" rules={[{ required: true }]} placeholder="如：请假审批" />
        <ProFormText name="biz_type" label="业务类型" rules={[{ required: true }]} placeholder="如：leave" />
        <ProFormTextArea name="description" label="说明" placeholder="描述此审批模板的用途" />
        <ProFormSelect
          name="workflow_definition_id"
          label="关联可视化流程"
          allowClear
          options={workflows.map((item) => ({ label: item.name, value: item.id }))}
          placeholder="选择后按流程图中的审批节点流转"
        />
        <ProFormTextArea
          name="steps_text"
          label="审批步骤 (JSON)"
          fieldProps={{ rows: 6 }}
          placeholder='[{"name":"部门审批","assignee":"部门负责人"}]'
        />
        <ProFormSelect
          name="status"
          label="状态"
          options={[{ label: '启用', value: 'ACTIVE' }, { label: '草稿', value: 'DRAFT' }]}
        />
      </ModalForm>

      {/* Submit Approval Modal */}
      <ModalForm<SubmitForm>
        title="发起审批"
        open={submitOpen}
        width={500}
        modalProps={{ destroyOnHidden: true, onCancel: () => setSubmitOpen(false) }}
        initialValues={{ form_data_text: '{}' }}
        onFinish={createInstance}
      >
        <ProFormText name="title" label="审批标题" rules={[{ required: true }]} placeholder="如：张三的请假申请" />
        <ProFormSelect
          name="template_id"
          label="审批模板"
          rules={[{ required: true }]}
          options={templates.map((item) => ({ label: `${item.name} (${item.biz_type})`, value: item.id }))}
          placeholder="选择要执行的审批模板"
        />
        <ProFormText name="biz_type" label="业务类型" placeholder="不填时使用模板业务类型" />
        <ProFormText name="biz_id" label="关联业务 ID" placeholder="可选" />
        <ProFormTextArea name="form_data_text" label="表单数据 (JSON)" fieldProps={{ rows: 4 }} placeholder='{"reason":"个人原因","days":3}' />
      </ModalForm>
    </div>
  );
}

function parseJSON(value: string) {
  try { return JSON.parse(value); } catch { throw new Error('JSON 格式不正确'); }
}

function resolveApprovalStepTitles(template: ApprovalTemplateRow, workflows: WorkflowRow[]) {
  if (template.workflow_definition_id) {
    const workflow = workflows.find((item) => item.id === template.workflow_definition_id);
    const nodes = Array.isArray(workflow?.definition?.nodes) ? workflow.definition.nodes : [];
    const titles = nodes
      .map((node) => node as { type?: string; name?: string; data?: { name?: string; nodeType?: string } })
      .filter((node) => (node.data?.nodeType ?? node.type) === 'approval')
      .map((node) => node.data?.name ?? node.name)
      .filter((name): name is string => Boolean(name));
    if (titles.length > 0) {
      return titles;
    }
  }
  return (template.steps ?? [])
    .map((step) => step as { name?: string })
    .map((step, index) => step.name ?? `审批节点 ${index + 1}`);
}

function approvalStepStatus(status: string, currentStep: number, index: number): 'finish' | 'process' | 'wait' | 'error' {
  if (status === 'REJECTED' && index === currentStep) return 'error';
  if (status === 'APPROVED' || index < currentStep) return 'finish';
  if (status === 'PENDING' && index === currentStep) return 'process';
  return 'wait';
}

function approvalStepDescription(status: string, currentStep: number, index: number) {
  if (status === 'REJECTED' && index === currentStep) return '已驳回';
  if (status === 'APPROVED' || index < currentStep) return '已通过';
  if (status === 'PENDING' && index === currentStep) return '待审批';
  return '未开始';
}
