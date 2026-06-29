import { DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined, HistoryOutlined } from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormSelect, ProFormText, ProFormTextArea, ProTable, type ActionType } from '@ant-design/pro-components';
import { App, Button, Drawer, Select, Space, Switch, Tag, Typography, message } from 'antd';
import { useRef, useState } from 'react';
import type { ProFormInstance } from '@ant-design/pro-components';
import { createTask, deleteTask, listExecutions, listTasks, runTask, toggleTask, updateTask, type ExecutionRow, type TaskForm, type TaskRow } from '../../../api/scheduler';
import { Permission } from '../../../components/Permission';

const { Text } = Typography;

const TASK_TYPES: Record<string, string> = {
  CUSTOM: '自定义脚本',
  DATA_SYNC: '数据同步',
  REPORT_GEN: '报表生成',
  NOTIFICATION: '通知发送',
  DATA_CLEANUP: '数据清理',
  AI_ANALYSIS: 'AI分析',
};

const CRON_PRESETS: { label: string; value: string }[] = [
  { label: '每小时', value: '0 * * * *' },
  { label: '每天凌晨2点', value: '0 2 * * *' },
  { label: '每天早上9点', value: '0 9 * * *' },
  { label: '每周一8点', value: '0 8 * * 1' },
  { label: '每月1号0点', value: '0 0 1 * *' },
  { label: '自定义', value: '' },
];

export function SchedulerPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [execDrawer, setExecDrawer] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [cronPreset, setCronPreset] = useState<string>('');

  const columns: ProColumns<TaskRow>[] = [
    { title: '任务名称', dataIndex: 'name', width: 180 },
    { title: 'Cron 表达式', dataIndex: 'cron_expr', width: 140, copyable: true },
    {
      title: '任务类型', dataIndex: 'task_type', width: 110,
      render: (_, row) => <Tag>{TASK_TYPES[row.task_type] || row.task_type}</Tag>,
    },
    {
      title: '状态', dataIndex: 'enabled', width: 80,
      render: (_, row) => (
        <Permission code="scheduler:toggle">
          <Switch checked={row.enabled} onChange={() => handleToggle(row)} size="small" />
        </Permission>
      ),
    },
    { title: '上次运行', dataIndex: 'last_run_at', width: 160, search: false, render: (_, row) => <Text>{row.last_run_at || '-'}</Text> },
    { title: '备注', dataIndex: 'remark', ellipsis: true, search: false },
    {
      title: '操作', valueType: 'option', width: 200,
      render: (_, row) => (
        <Space>
          <Permission code="scheduler:run">
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleRun(row)}>执行</Button>
          </Permission>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => { setSelectedTask(row); setExecDrawer(true); }}>日志</Button>
          <Permission code="scheduler:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); setOpen(true); }}>编辑</Button>
          </Permission>
          <Permission code="scheduler:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>删除</Button>
          </Permission>
        </Space>
      ),
    },
  ];

  async function handleToggle(row: TaskRow) {
    try {
      await toggleTask(row.id);
      message.success(row.enabled ? '已禁用' : '已启用');
      actionRef.current?.reload();
    } catch {
      message.error('操作失败，请稍后重试');
    }
  }

  async function handleRun(row: TaskRow) {
    try {
      await runTask(row.id);
      message.success(`任务「${row.name}」已执行`);
      actionRef.current?.reload();
    } catch {
      message.error('执行失败，请稍后重试');
    }
  }

  function confirmDelete(row: TaskRow) {
    modal.confirm({
      title: `确定删除任务「${row.name}」吗？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteTask(row.id);
          message.success('已删除');
          actionRef.current?.reload();
        } catch {
          message.error('删除失败，请稍后重试');
        }
      },
    });
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      <ProTable<TaskRow>
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          try {
            const res = await listTasks({ keyword: typeof params.name === 'string' ? params.name : undefined, page: params.current, page_size: params.pageSize });
            return { data: res.items, total: res.total, success: true };
          } catch {
            message.error('加载任务列表失败');
            return { data: [], total: 0, success: false };
          }
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        headerTitle="定时任务"
        toolBarRender={() => [
          <Permission code="scheduler:create" key="add">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setOpen(true); }}>新增任务</Button>
          </Permission>,
        ]}
        pagination={{ defaultPageSize: 10 }}
      />

      <ModalForm<TaskForm>
        title={editing ? '编辑任务' : '新增任务'}
        open={open}
        onOpenChange={(visible) => {
          setOpen(visible);
          if (visible && formRef.current) {
            const expr = editing?.cron_expr || '';
            const found = CRON_PRESETS.find((p) => p.value === expr);
            setCronPreset(found ? (found.value || '') : '');
            if (!found && expr) setCronPreset('');
          } else if (!visible) {
            setCronPreset('');
          }
        }}
        formRef={formRef}
        initialValues={editing ? { name: editing.name, cron_expr: editing.cron_expr, task_type: editing.task_type, config: editing.config ?? '', remark: editing.remark ?? '' } : { task_type: 'CUSTOM' }}
        onFinish={async (values) => {
          try {
            if (editing) { await updateTask(editing.id, values); } else { await createTask(values); }
            message.success(editing ? '已更新' : '已创建');
            actionRef.current?.reload();
            return true;
          } catch {
            message.error('保存任务失败，请稍后重试');
            return false;
          }
        }}
        modalProps={{ destroyOnClose: true }}
      >
        <ProFormText name="name" label="任务名称" rules={[{ required: true }]} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <Select
            allowClear
            placeholder="选择 Cron 预设"
            style={{ width: 200 }}
            value={cronPreset}
            onChange={(val) => {
              setCronPreset(val || '');
              if (val && formRef.current) {
                formRef.current.setFieldsValue({ cron_expr: val });
              }
            }}
            options={CRON_PRESETS.map((p) => ({ label: p.label, value: p.value }))}
          />
          <ProFormText name="cron_expr" label={null} placeholder="0 * * * *" style={{ flex: 1 }} />
        </div>
        <ProFormSelect name="task_type" label="任务类型" options={Object.entries(TASK_TYPES).map(([k, v]) => ({ label: v, value: k }))} />
        <ProFormTextArea name="config" label="配置 (JSON)" />
        <ProFormTextArea name="remark" label="备注" />
      </ModalForm>

      <Drawer title={`执行日志 - ${selectedTask?.name || ''}`} open={execDrawer} onClose={() => setExecDrawer(false)} width={700}>
        {selectedTask && <ExecutionLogs taskId={selectedTask.id} />}
      </Drawer>
    </div>
  );
}

function ExecutionLogs({ taskId }: { taskId: number }) {
  const columns: ProColumns<ExecutionRow>[] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '状态', dataIndex: 'status', width: 80, render: (_, row) => <Tag color={row.status === 'SUCCESS' ? 'green' : 'red'}>{row.status}</Tag> },
    { title: '开始时间', dataIndex: 'started_at', width: 160 },
    { title: '完成时间', dataIndex: 'finished_at', width: 160, render: (_, row) => row.finished_at || '-' },
    { title: '输出', dataIndex: 'output', ellipsis: true },
  ];

  return (
    <ProTable<ExecutionRow>
      columns={columns}
      request={async (params) => {
        try {
          const res = await listExecutions(taskId, { page: params.current, page_size: params.pageSize });
          return { data: res.items, total: res.total, success: true };
        } catch {
          message.error('加载执行日志失败');
          return { data: [], total: 0, success: false };
        }
      }}
      rowKey="id"
      search={false}
      options={false}
      pagination={{ defaultPageSize: 10 }}
    />
  );
}
