import {
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ProColumns, ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Input, Modal, Space, Statistic, Tag, Typography, message } from 'antd';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actionApproval, listTodos, type TodoRow } from '../../../api/collaboration';
import { Permission } from '../../../components/Permission';
import { buildApprovalActionPayload, requiresApprovalComment, type ApprovalAction } from '../approvalActions';

const { Text } = Typography;

export function TodoCenterPage() {
  const actionRef = useRef<ActionType>(null);
  const navigate = useNavigate();
  const [items, setItems] = useState<TodoRow[]>([]);
  const [pendingAction, setPendingAction] = useState<{ row: TodoRow; action: ApprovalAction } | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const columns: ProColumns<TodoRow>[] = [
    {
      title: '待办标题',
      dataIndex: 'title',
      ellipsis: true,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.title}</Text>
          <Text type="secondary">{row.biz_id || row.biz_type}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'source_module',
      width: 110,
      render: () => <Tag color="blue">审批</Tag>,
    },
    {
      title: '当前节点',
      dataIndex: 'current_step_name',
      width: 180,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text>{row.current_step_name || `第 ${row.current_step + 1} 步`}</Text>
          <Text type="secondary">{row.assignee}</Text>
        </Space>
      ),
    },
    { title: '申请人', dataIndex: 'applicant', width: 120 },
    { title: '到达时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180, search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 230,
      render: (_, row) => (
        <Space>
          <Permission code="approval:action">
            <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openAction(row, 'APPROVE')}>
              通过
            </Button>
            <Button type="link" danger size="small" icon={<CloseOutlined />} onClick={() => openAction(row, 'REJECT')}>
              驳回
            </Button>
          </Permission>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate('/collaboration/approvals')}>
            审批中心
          </Button>
        </Space>
      ),
    },
  ];

  function openAction(row: TodoRow, action: ApprovalAction) {
    setPendingAction({ row, action });
    setActionComment('');
  }

  async function submitAction() {
    if (!pendingAction) return;
    if (requiresApprovalComment(pendingAction.action) && !actionComment.trim()) {
      message.warning('请输入驳回原因');
      return;
    }
    setSubmitting(true);
    try {
      await actionApproval(pendingAction.row.source_id, buildApprovalActionPayload(pendingAction.action, actionComment));
      message.success(pendingAction.action === 'APPROVE' ? '已通过' : '已驳回');
      setPendingAction(null);
      setActionComment('');
      actionRef.current?.reload();
    } catch (err: unknown) {
      message.error(requestErrorMessage(err, '处理待办失败'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <Space style={{ marginBottom: 16 }} size={16}>
        <Statistic title="我的待办" value={items.length} prefix={<ClockCircleOutlined />} />
        <Button icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>
          刷新
        </Button>
      </Space>

      <ProTable<TodoRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async () => {
          try {
            const data = await listTodos();
            setItems(data);
            return { data, success: true };
          } catch {
            message.error('加载待办失败');
            return { data: [], success: false };
          }
        }}
        search={false}
        options={{ reload: true, density: true }}
      />

      <Modal
        title={pendingAction?.action === 'APPROVE' ? '确认通过审批' : '确认驳回审批'}
        open={Boolean(pendingAction)}
        okText={pendingAction?.action === 'APPROVE' ? '通过' : '驳回'}
        okButtonProps={{ danger: pendingAction?.action === 'REJECT' }}
        confirmLoading={submitting}
        onCancel={() => {
          setPendingAction(null);
          setActionComment('');
        }}
        onOk={submitAction}
      >
        {pendingAction?.action === 'REJECT' ? (
          <Input.TextArea
            value={actionComment}
            onChange={(event) => setActionComment(event.target.value)}
            placeholder="请输入驳回原因"
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        ) : (
          <Text>确认通过「{pendingAction?.row.title}」当前审批节点？</Text>
        )}
      </Modal>
    </div>
  );
}

function requestErrorMessage(err: unknown, fallback: string) {
  const response = (err as { response?: { data?: { message?: string } } }).response;
  return response?.data?.message || fallback;
}
