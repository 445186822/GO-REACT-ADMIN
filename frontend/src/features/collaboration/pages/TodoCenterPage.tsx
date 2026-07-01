import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ProColumns, ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Input, Modal, Space, Tabs, Tag, Typography } from 'antd';
import { message, notification, requestErrorMessage } from '../../../utils/message';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actionApproval, listTodos, type TodoRow } from '../../../api/collaboration';
import { Permission } from '../../../components/Permission';
import { operationColumnProps } from '../../../utils/tableColumns';
import { buildApprovalActionPayload, requiresApprovalComment, type ApprovalAction } from '../approvalActions';
import { countTodosByScope, todoScopeLabel, type TodoScope } from '../todoView';

const { Text } = Typography;

export function TodoCenterPage() {
  const actionRef = useRef<ActionType>(null);
  const navigate = useNavigate();
  const [activeScope, setActiveScope] = useState<TodoScope>('pending');
  const [items, setItems] = useState<TodoRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, done: 0 });
  const [pendingAction, setPendingAction] = useState<{ row: TodoRow; action: ApprovalAction } | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const columns = useMemo<ProColumns<TodoRow>[]>(() => [
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
    ...(activeScope === 'done'
      ? [
          {
            title: '处理结果',
            dataIndex: 'action',
            width: 110,
            search: false,
            render: (_: unknown, row: TodoRow) => <Tag color={row.action === 'APPROVE' ? 'green' : 'red'}>{row.action === 'APPROVE' ? '已通过' : '已驳回'}</Tag>,
          } as ProColumns<TodoRow>,
        ]
      : []),
    { title: activeScope === 'pending' ? '到达时间' : '处理时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180, search: false },
    {
      title: '操作',
      ...operationColumnProps<TodoRow>(activeScope === 'pending' ? 240 : 140),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          {activeScope === 'pending' && (
            <Permission code="approval:action">
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => openAction(row, 'APPROVE')}>
                通过
              </Button>
              <Button type="link" danger size="small" icon={<CloseOutlined />} onClick={() => openAction(row, 'REJECT')}>
                驳回
              </Button>
            </Permission>
          )}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate('/collaboration/approvals')}>
            审批中心
          </Button>
        </Space>
      ),
    },
  ], [activeScope, navigate]);

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
      const msg = requestErrorMessage(err, '处理待办失败');
      notification.error({ message: '操作失败', description: msg, duration: 0 });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <Tabs
        activeKey={activeScope}
        onChange={(key) => {
          setActiveScope(key as TodoScope);
        }}
        items={[
          { key: 'pending', label: `${todoScopeLabel('pending')} (${counts.pending})` },
          { key: 'done', label: `${todoScopeLabel('done')} (${counts.done})` },
        ]}
      />

      <ProTable<TodoRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        params={{ activeScope }}
        request={async () => {
          try {
            const inactiveScope: TodoScope = activeScope === 'pending' ? 'done' : 'pending';
            const [data, inactiveData] = await Promise.all([
              listTodos({ scope: activeScope }),
              listTodos({ scope: inactiveScope }),
            ]);
            setItems(data);
            setCounts(countTodosByScope([...data, ...inactiveData]));
            return { data, success: true };
          } catch {
            message.error('加载待办失败');
            return { data: [], success: false };
          }
        }}
        search={false}
        options={{ reload: false, density: true }}
        toolBarRender={() => [
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => actionRef.current?.reload()}>
            刷新
          </Button>,
        ]}
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


