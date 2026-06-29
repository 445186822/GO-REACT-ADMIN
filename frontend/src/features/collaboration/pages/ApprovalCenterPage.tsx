import {
  AuditOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  ExpandOutlined,
  SendOutlined,
  UserOutlined,
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
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Row,
  Skeleton,
  Space,
  Statistic,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  actionApproval,
  getApprovalInstance,
  listApprovalInstances,
  listWorkflows,
  submitApproval,
  type ApprovalInstanceRow,
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

type SubmitForm = Omit<Partial<ApprovalInstanceRow>, 'form_data'> & { form_data_text?: string };

const STATUS_FLOW: Record<string, { color: string; label: string }> = {
  PENDING: { color: 'processing', label: '待审批' },
  APPROVED: { color: 'success', label: '已通过' },
  REJECTED: { color: 'error', label: '已驳回' },
  WITHDRAWN: { color: 'default', label: '已撤回' },
};

export function ApprovalCenterPage() {
  const instanceRef = useRef<ActionType>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<ApprovalInstanceRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [instances, setInstances] = useState<ApprovalInstanceRow[]>([]);
  const [pendingAction, setPendingAction] = useState<{ id: number; action: ApprovalAction } | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listWorkflows({ category: 'approval', status: 'ACTIVE' })
      .then(setWorkflows)
      .catch(() => message.error('加载审批工作流失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!detailVisible || !selectedInstance?.id) return;
    let ignore = false;
    setDetailLoading(true);
    getApprovalInstance(selectedInstance.id)
      .then((data) => {
        if (!ignore) setSelectedInstance(data);
      })
      .catch(() => message.error('加载审批详情失败'))
      .finally(() => {
        if (!ignore) setDetailLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [detailVisible, selectedInstance?.id]);

  const instanceColumns: ProColumns<ApprovalInstanceRow>[] = [
    {
      title: '审批标题',
      dataIndex: 'title',
      width: 240,
      ellipsis: true,
      render: (_, row) => <a onClick={() => openInstanceDetail(row)}>{row.title}</a>,
    },
    {
      title: '审批工作流',
      dataIndex: 'workflow',
      width: 180,
      search: false,
      render: (_, row) => <Tag color="blue">{row.workflow}</Tag>,
    },
    {
      title: '业务类型',
      dataIndex: 'biz_type',
      width: 120,
      render: (_, row) => <Tag color="purple">{row.biz_type}</Tag>,
    },
    {
      title: '申请人',
      dataIndex: 'applicant',
      width: 120,
      search: false,
      render: (_, row) => (
        <Space size={4}>
          <Avatar size="small" icon={<UserOutlined />} />
          {row.applicant}
        </Space>
      ),
    },
    {
      title: '审批状态',
      dataIndex: 'status',
      width: 120,
      render: (_, row) => {
        const cfg = STATUS_FLOW[row.status] || { color: 'default', label: row.status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    { title: '当前步骤', dataIndex: 'current_step', width: 110, search: false },
    { title: '提交时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 210,
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" icon={<ExpandOutlined />} onClick={() => openInstanceDetail(row)}>
            详情
          </Button>
          {row.status === 'PENDING' && (
            <Permission code="approval:action">
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleAction(row.id, 'APPROVE')}>
                通过
              </Button>
              <Button type="link" danger size="small" icon={<CloseOutlined />} onClick={() => handleAction(row.id, 'REJECT')}>
                驳回
              </Button>
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

  function openInstanceDetail(row: ApprovalInstanceRow) {
    setSelectedInstance(row);
    setDetailVisible(true);
  }

  async function submitApprovalAction() {
    if (!pendingAction) return;
    if (requiresApprovalComment(pendingAction.action) && !actionComment.trim()) {
      message.warning('请输入驳回原因');
      return;
    }
    setActionSubmitting(true);
    try {
      const actionID = pendingAction.id;
      await actionApproval(actionID, buildApprovalActionPayload(pendingAction.action, actionComment));
      message.success(`审批已${approvalActionLabel(pendingAction.action)}`);
      setPendingAction(null);
      setActionComment('');
      instanceRef.current?.reload();
      if (detailVisible && selectedInstance?.id === actionID) {
        void getApprovalInstance(actionID).then(setSelectedInstance);
      }
    } catch (err: unknown) {
      message.error(requestErrorMessage(err, '审批处理失败'));
    } finally {
      setActionSubmitting(false);
    }
  }

  async function createInstance(values: SubmitForm) {
    try {
      const payload = { ...values, form_data: parseJSON(values.form_data_text || '{}') };
      delete payload.form_data_text;
      await submitApproval(payload);
      message.success('审批已提交');
      setSubmitOpen(false);
      instanceRef.current?.reload();
      return true;
    } catch (err: unknown) {
      message.error(requestErrorMessage(err, '提交审批失败'));
      return false;
    }
  }

  const currentStep = selectedInstance?.current_step || 0;
  const selectedWorkflow = selectedInstance
    ? workflows.find((item) => item.id === selectedInstance.workflow_definition_id)
    : undefined;
  const approvalStepTitles = selectedWorkflow ? resolveApprovalStepTitles(selectedWorkflow) : [];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {loading && <Skeleton active paragraph={{ rows: 6 }} style={{ marginBottom: 24 }} />}

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
            <Statistic title="审批工作流" value={workflows.length} prefix={<AuditOutlined />} />
          </Card>
        </Col>
      </Row>

      <ProTable<ApprovalInstanceRow>
        actionRef={instanceRef}
        rowKey="id"
        columns={instanceColumns}
        toolBarRender={() => [
          <Permission code="approval:submit" key="submit">
            <Button type="primary" icon={<SendOutlined />} onClick={() => setSubmitOpen(true)}>
              发起审批
            </Button>
          </Permission>,
        ]}
        request={async (params) => {
          try {
            const data = await listApprovalInstances({
              keyword: typeof params.title === 'string' ? params.title : undefined,
              biz_type: typeof params.biz_type === 'string' ? params.biz_type : undefined,
              status: typeof params.status === 'string' ? params.status : undefined,
            });
            setInstances(data);
            return { data, success: true };
          } catch {
            message.error('加载审批实例失败');
            return { data: [], success: false };
          }
        }}
        search={{ labelWidth: 'auto', defaultCollapsed: true }}
        options={{ reload: true, density: true }}
      />

      <Drawer
        title={<Space><AuditOutlined />审批详情 - {selectedInstance?.title}</Space>}
        open={detailVisible}
        onClose={() => { setDetailVisible(false); setSelectedInstance(null); }}
        width={640}
      >
        {selectedInstance && !detailLoading && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="标题">{selectedInstance.title}</Descriptions.Item>
              <Descriptions.Item label="审批工作流">
                <Tag color="blue">{selectedInstance.workflow}</Tag>
              </Descriptions.Item>
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
              <Descriptions.Item label="提交时间">{selectedInstance.created_at}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>审批进度</Title>
            <Steps
              current={currentStep}
              size="small"
              direction="vertical"
              style={{ marginBottom: 24 }}
              items={(approvalStepTitles.length ? approvalStepTitles : ['未配置审批节点']).map((title, index) => ({
                title,
                description: <Text type="secondary">{approvalStepDescription(selectedInstance.status, currentStep, index)}</Text>,
                status: approvalStepStatus(selectedInstance.status, currentStep, index),
              }))}
            />

            <Title level={5}>审批历史</Title>
            <Timeline items={buildApprovalTimelineItems(selectedInstance)} />
          </>
        )}
        {detailLoading && <Skeleton active paragraph={{ rows: 6 }} />}
      </Drawer>

      <Modal
        title={pendingAction ? `确认${approvalActionLabel(pendingAction.action)}` : ''}
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

      <ModalForm<SubmitForm>
        title="发起审批"
        open={submitOpen}
        width={520}
        modalProps={{ destroyOnHidden: true, onCancel: () => setSubmitOpen(false) }}
        initialValues={{ biz_type: 'approval', form_data_text: '{}' }}
        onFinish={createInstance}
      >
        <ProFormText name="title" label="审批标题" rules={[{ required: true }]} placeholder="如：王五的病假申请（3天）" />
        <ProFormSelect
          name="workflow_definition_id"
          label="审批工作流"
          rules={[{ required: true }]}
          options={workflows.map((item) => ({ label: item.name, value: item.id }))}
          placeholder="选择要执行的审批工作流"
        />
        <ProFormText name="biz_type" label="业务类型" placeholder="如：leave / customer_onboarding" />
        <ProFormText name="biz_id" label="关联业务 ID" placeholder="可选" />
        <ProFormTextArea name="form_data_text" label="表单数据 (JSON)" fieldProps={{ rows: 4 }} placeholder='{"reason":"个人原因","days":3}' />
      </ModalForm>
    </div>
  );
}

function parseJSON(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('JSON 格式不正确');
  }
}

function resolveApprovalStepTitles(workflow: WorkflowRow) {
  const nodes = Array.isArray(workflow.definition?.nodes) ? workflow.definition.nodes : [];
  return nodes
    .map((node) => node as { type?: string; name?: string; data?: { name?: string; nodeType?: string } })
    .filter((node) => (node.data?.nodeType ?? node.type) === 'approval')
    .map((node) => node.data?.name ?? node.name)
    .filter((name): name is string => Boolean(name));
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

function buildApprovalTimelineItems(instance: ApprovalInstanceRow) {
  const items = [
    {
      color: 'green',
      children: (
        <>
          <Text strong>{instance.applicant}</Text> 提交了审批 <Text type="secondary">{instance.created_at}</Text>
        </>
      ),
    },
  ];

  for (const action of instance.actions ?? []) {
    const isApprove = action.action === 'APPROVE';
    items.push({
      color: isApprove ? 'blue' : 'red',
      children: (
        <Space direction="vertical" size={2}>
          <span>
            <Text strong>{action.approver}</Text> {isApprove ? '通过了' : '驳回了'}第 {action.step_index + 1} 步审批{' '}
            <Text type="secondary">{action.created_at}</Text>
          </span>
          {action.comment ? <Text type="secondary">{action.comment}</Text> : null}
        </Space>
      ),
    });
  }

  return items;
}

function requestErrorMessage(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { message?: string } } }).response;
  return response?.data?.message || fallback;
}
