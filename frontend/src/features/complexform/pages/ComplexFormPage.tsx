import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormCheckbox,
  ProFormDatePicker,
  ProFormDateRangePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormMoney,
  ProFormRadio,
  ProFormRate,
  ProFormSelect,
  ProFormSlider,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProFormTimePicker,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import { App, Button, Col, Divider, Row, Space, Tag } from 'antd';
import { useRef, useState } from 'react';
import {
  createComplexForm,
  deleteComplexForm,
  listComplexForms,
  updateComplexForm,
  type ComplexFormPayload,
  type ComplexFormRow,
} from '../../../api/complexForms';
import { Permission } from '../../../components/Permission';
import { message } from '../../../utils/message';
import { operationColumnProps } from '../../../utils/tableColumns';

type ComplexFormValues = ComplexFormPayload & {
  active_range?: string[];
  feature_flags?: string[];
  tags?: string[];
  address?: string;
  risk_level?: string;
  delivery_mode?: string;
  approval_required?: boolean;
  approval_note?: string;
  custom_json_text?: string;
};

export function ComplexFormPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ComplexFormRow | null>(null);

  const columns: ProColumns<ComplexFormRow>[] = [
    { title: '关键词', dataIndex: 'keyword', hideInTable: true },
    { title: '标题', dataIndex: 'title', width: 220, copyable: true, search: false },
    { title: '申请人', dataIndex: 'applicant', width: 120, search: false },
    { title: '部门', dataIndex: 'department', width: 130, search: false },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      search: false,
      render: (_, row) => categoryText(row.category),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 110,
      search: false,
      render: (_, row) => <Tag color={priorityColor(row.priority)}>{priorityText(row.priority)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      valueType: 'select',
      valueEnum: statusValueEnum,
      render: (_, row) => <Tag color={statusColor(row.status)}>{statusText(row.status)}</Tag>,
    },
    { title: '金额', dataIndex: 'amount', width: 120, search: false, render: (_, row) => (row.amount == null ? '-' : `¥${row.amount.toFixed(2)}`) },
    { title: '进度', dataIndex: 'progress', width: 100, search: false, render: (_, row) => (row.progress == null ? '-' : `${row.progress}%`) },
    { title: '创建时间', dataIndex: 'created_at', width: 170, search: false },
    {
      title: '操作',
      ...operationColumnProps<ComplexFormRow>(180),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="complex-form:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="complex-form:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: ComplexFormRow) {
    setEditing(row);
    setOpen(true);
  }

  function confirmDelete(row: ComplexFormRow) {
    modal.confirm({
      title: `删除复杂表单「${row.title}」?`,
      content: '删除后记录会被软删除，列表中不再展示。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteComplexForm(row.id);
        message.success('复杂表单已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: ComplexFormValues) {
    const payload = buildPayload(values);
    if (!payload) {
      return false;
    }

    if (editing) {
      await updateComplexForm(editing.id, payload);
      message.success('复杂表单已更新');
    } else {
      await createComplexForm(payload);
      message.success('复杂表单已创建');
    }
    setOpen(false);
    setEditing(null);
    actionRef.current?.reload();
    return true;
  }

  return (
    <div>
      <ProTable<ComplexFormRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const data = await listComplexForms({
            keyword: String(params.keyword ?? ''),
            status: String(params.status ?? ''),
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        pagination={{ defaultPageSize: 10 }}
        toolBarRender={() => [
          <Permission code="complex-form:create" key="create">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新增复杂表单
            </Button>
          </Permission>,
        ]}
      />

      <ModalForm<ComplexFormValues>
        key={editing ? `edit-${editing.id}` : 'create'}
        title={editing ? '编辑复杂表单' : '新增复杂表单'}
        open={open}
        width={960}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            setOpen(false);
            setEditing(null);
          },
        }}
        initialValues={editing ? rowToFormValues(editing) : defaultValues}
        onFinish={submit}
      >
        <Divider orientation="left">基础信息</Divider>
        <Row gutter={16}>
          <Col span={12}><ProFormText name="title" label="表单标题" rules={[{ required: true }]} placeholder="如：供应商准入申请" /></Col>
          <Col span={6}><ProFormText name="applicant" label="申请人" rules={[{ required: true }]} /></Col>
          <Col span={6}><ProFormText name="department" label="申请部门" rules={[{ required: true }]} /></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><ProFormSelect name="category" label="业务分类" options={categoryOptions} rules={[{ required: true }]} /></Col>
          <Col span={8}><ProFormRadio.Group name="priority" label="优先级" options={priorityOptions} rules={[{ required: true }]} /></Col>
          <Col span={8}><ProFormSelect name="status" label="状态" options={statusOptions} rules={[{ required: true }]} /></Col>
        </Row>

        <Divider orientation="left">数值与时间</Divider>
        <Row gutter={16}>
          <Col span={8}><ProFormMoney name="amount" label="预算金额" min={0} fieldProps={{ precision: 2 }} /></Col>
          <Col span={8}><ProFormDigit name="quantity" label="数量" min={0} max={999999} /></Col>
          <Col span={8}><ProFormDigit name="score" label="综合评分" min={0} max={100} /></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><ProFormDatePicker name="start_date" label="开始日期" /></Col>
          <Col span={8}><ProFormDateRangePicker name="active_range" label="有效期" /></Col>
          <Col span={8}><ProFormTimePicker name="appointment_time" label="预约时间" /></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><ProFormSlider name="progress" label="完成进度" min={0} max={100} /></Col>
          <Col span={8}><ProFormRate name="rating" label="满意度" /></Col>
          <Col span={8}><ProFormSwitch name="enabled" label="是否启用" /></Col>
        </Row>

        <Divider orientation="left">联系与扩展</Divider>
        <Row gutter={16}>
          <Col span={8}><ProFormText name="contact_name" label="联系人" /></Col>
          <Col span={8}><ProFormText name="contact_phone" label="联系电话" /></Col>
          <Col span={8}><ProFormText name="contact_email" label="联系邮箱" /></Col>
        </Row>
        <ProFormText name="attachment_url" label="附件链接" placeholder="https://example.com/attachment.pdf" />
        <Row gutter={16}>
          <Col span={12}><ProFormCheckbox.Group name="feature_flags" label="业务标签" options={featureFlagOptions} /></Col>
          <Col span={12}><ProFormSelect name="tags" label="关联标签" mode="tags" placeholder="输入后回车生成标签" /></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><ProFormSelect name="risk_level" label="风险等级" options={riskOptions} /></Col>
          <Col span={8}><ProFormRadio.Group name="delivery_mode" label="交付方式" options={deliveryOptions} /></Col>
          <Col span={8}><ProFormSwitch name="approval_required" label="需要审批" /></Col>
        </Row>
        <ProFormDependency name={['approval_required']}>
          {({ approval_required }) => approval_required ? <ProFormText name="approval_note" label="审批说明" placeholder="说明审批原因或关键风险" /> : null}
        </ProFormDependency>
        <ProFormTextArea name="address" label="详细地址" fieldProps={{ rows: 2 }} />
        <ProFormTextArea name="custom_json_text" label="扩展 JSON" fieldProps={{ rows: 4 }} placeholder='{"source":"demo","items":[{"name":"示例"}]}' />
        <ProFormTextArea name="remark" label="备注" fieldProps={{ rows: 3 }} />
      </ModalForm>
    </div>
  );
}

const defaultValues: Partial<ComplexFormValues> = {
  category: 'PROCUREMENT',
  priority: 'MEDIUM',
  status: 'DRAFT',
  enabled: true,
  progress: 0,
  rating: 3,
  approval_required: false,
};

const categoryOptions = [
  { label: '采购申请', value: 'PROCUREMENT' },
  { label: '合同审批', value: 'CONTRACT' },
  { label: '资产领用', value: 'ASSET' },
  { label: '差旅申请', value: 'TRAVEL' },
  { label: '其他业务', value: 'OTHER' },
];

const priorityOptions = [
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
  { label: '紧急', value: 'URGENT' },
];

const statusOptions = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已提交', value: 'SUBMITTED' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已归档', value: 'ARCHIVED' },
];

const featureFlagOptions = [
  { label: '跨部门', value: 'cross_department' },
  { label: '需法务', value: 'legal_review' },
  { label: '含预算', value: 'budget_related' },
  { label: '紧急交付', value: 'urgent_delivery' },
];

const riskOptions = [
  { label: '低风险', value: 'LOW' },
  { label: '中风险', value: 'MEDIUM' },
  { label: '高风险', value: 'HIGH' },
];

const deliveryOptions = [
  { label: '线上', value: 'ONLINE' },
  { label: '线下', value: 'OFFLINE' },
  { label: '混合', value: 'HYBRID' },
];

const statusValueEnum = Object.fromEntries(statusOptions.map((item) => [item.value, { text: item.label }]));

function rowToFormValues(row: ComplexFormRow): ComplexFormValues {
  const extra = row.form_extra ?? {};
  return {
    title: row.title,
    applicant: row.applicant,
    department: row.department,
    category: row.category,
    priority: row.priority,
    status: row.status,
    amount: row.amount,
    quantity: row.quantity,
    score: row.score,
    progress: row.progress,
    rating: row.rating,
    enabled: row.enabled,
    start_date: row.start_date,
    end_date: row.end_date,
    appointment_time: row.appointment_time,
    contact_name: row.contact_name,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    attachment_url: row.attachment_url,
    remark: row.remark,
    active_range: row.start_date && row.end_date ? [row.start_date, row.end_date] : undefined,
    feature_flags: extra.feature_flags,
    tags: extra.tags,
    address: extra.address,
    risk_level: extra.risk_level,
    delivery_mode: extra.delivery_mode,
    approval_required: extra.approval_required,
    approval_note: extra.approval_note,
    custom_json_text: extra.custom_json ? JSON.stringify(extra.custom_json, null, 2) : undefined,
  };
}

function buildPayload(values: ComplexFormValues): ComplexFormPayload | null {
  let customJson: unknown;
  if (values.custom_json_text?.trim()) {
    try {
      customJson = JSON.parse(values.custom_json_text);
    } catch {
      message.error('扩展 JSON 格式不正确');
      return null;
    }
  }

  const activeRange = values.active_range ?? [];
  return {
    title: values.title,
    applicant: values.applicant,
    department: values.department,
    category: values.category,
    priority: values.priority,
    status: values.status,
    amount: values.amount,
    quantity: values.quantity,
    score: values.score,
    progress: values.progress,
    rating: values.rating,
    enabled: values.enabled,
    start_date: activeRange[0] ?? values.start_date,
    end_date: activeRange[1] ?? values.end_date,
    appointment_time: values.appointment_time,
    contact_name: values.contact_name,
    contact_phone: values.contact_phone,
    contact_email: values.contact_email,
    attachment_url: values.attachment_url,
    remark: values.remark,
    form_extra: {
      feature_flags: values.feature_flags,
      tags: values.tags,
      address: values.address,
      risk_level: values.risk_level,
      delivery_mode: values.delivery_mode,
      approval_required: values.approval_required,
      approval_note: values.approval_note,
      custom_json: customJson,
    },
  };
}

function categoryText(value: ComplexFormRow['category']) {
  return categoryOptions.find((item) => item.value === value)?.label ?? value;
}

function priorityText(value: ComplexFormRow['priority']) {
  return priorityOptions.find((item) => item.value === value)?.label ?? value;
}

function priorityColor(value: ComplexFormRow['priority']) {
  if (value === 'URGENT') return 'red';
  if (value === 'HIGH') return 'orange';
  if (value === 'LOW') return 'default';
  return 'blue';
}

function statusText(value: ComplexFormRow['status']) {
  return statusOptions.find((item) => item.value === value)?.label ?? value;
}

function statusColor(value: ComplexFormRow['status']) {
  if (value === 'APPROVED') return 'green';
  if (value === 'REJECTED') return 'red';
  if (value === 'SUBMITTED') return 'blue';
  if (value === 'ARCHIVED') return 'default';
  return 'gold';
}
