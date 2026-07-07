import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
  type ActionType,
} from '@ant-design/pro-components';
import { Alert, App, Button, Space, Tag, Tooltip } from 'antd';
import { message } from '../../../utils/message';
import { useRef, useState } from 'react';
import {
  createCustomer,
  deleteCustomer,
  downloadCustomerImportTemplate,
  exportCustomers,
  importCustomers,
  listCustomers,
  updateCustomer,
  type CustomerForm,
  type CustomerRow,
} from '../../../api/customers';
import { BackendDownloadButton } from '../../../components/BackendDownloadButton';
import { ExcelImportModal } from '../../../components/ExcelImportModal';
import { Permission } from '../../../components/Permission';
import { operationColumnProps } from '../../../utils/tableColumns';
import {
  customerImportFailureDetail,
  customerImportSummary,
  customerImportTemplateColumns,
  customerImportTemplateRows,
} from '../customerImportView';

export function CustomerListPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [importing, setImporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<Awaited<ReturnType<typeof importCustomers>> | null>(null);

  const columns: ProColumns<CustomerRow>[] = [
    { title: '客户名称', dataIndex: 'name', copyable: true, width: 160 },
    {
      title: '级别',
      dataIndex: 'level',
      valueType: 'select',
      valueEnum: {
        IMPORTANT: { text: '重点客户' },
        NORMAL: { text: '普通客户' },
        POTENTIAL: { text: '潜在客户' },
      },
      render: (_, row) => <Tag color={row.level === 'IMPORTANT' ? 'red' : row.level === 'POTENTIAL' ? 'blue' : 'default'}>{levelText(row.level)}</Tag>,
    },
    { title: '负责人', dataIndex: 'owner', search: false, width: 150 },
    { title: '所属部门', dataIndex: 'department', search: false, width: 140 },
    { title: '手机', dataIndex: 'phone', search: false, width: 140 },
    { title: '邮箱', dataIndex: 'email', search: false, width: 170 },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        ACTIVE: { text: '有效', status: 'Success' },
        DISABLED: { text: '停用', status: 'Default' },
      },
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status === 'ACTIVE' ? '有效' : '停用'}</Tag>,
    },
    {
      title: '操作',
      ...operationColumnProps<CustomerRow>(180),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Permission code="customer:update">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
              编辑
            </Button>
          </Permission>
          <Permission code="customer:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function openEdit(row: CustomerRow) {
    setEditing(row);
    setOpen(true);
  }

  function confirmDelete(row: CustomerRow) {
    modal.confirm({
      title: `删除客户 ${row.name}?`,
      content: '客户采用软删除，后续可扩展回收站和审计日志。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteCustomer(row.id);
        message.success('客户已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function submit(values: CustomerForm) {
    if (editing) {
      await updateCustomer(editing.id, values);
      message.success('客户已更新');
    } else {
      await createCustomer(values);
      message.success('客户已创建');
    }
    setOpen(false);
    setEditing(null);
    actionRef.current?.reload();
    return true;
  }

  async function handleExportCustomers() {
    await exportCustomers();
    message.success('客户 Excel 已生成');
  }

  async function downloadImportTemplate() {
    await downloadCustomerImportTemplate();
    message.success('客户导入模板已下载');
  }

  async function submitImportCustomers() {
    if (!importFile) {
      message.warning('请选择 Excel 文件');
      return;
    }
    setImporting(true);
    try {
      const result = await importCustomers(importFile);
      const detail = customerImportFailureDetail(result);
      setImportResult(result);
      if (result.failed > 0) {
        message.warning(detail ? `${customerImportSummary(result)}\n${detail}` : customerImportSummary(result), 8);
      } else {
        message.success(customerImportSummary(result));
        setImportModalOpen(false);
        setImportFile(null);
      }
      actionRef.current?.reload();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      <ProTable<CustomerRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        search={{ labelWidth: 80 }}
        request={async (params) => {
          const data = await listCustomers({
            keyword: params.keyword as string | undefined,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        toolBarRender={() => [
          selectedRowKeys.length > 0 ? (
            <Permission code="customer:delete" key="batch-delete">
              <Tooltip title={`已选择 ${selectedRowKeys.length} 项`}>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    modal.confirm({
                      title: `确定批量删除选中的 ${selectedRowKeys.length} 个客户吗？`,
                      content: '客户采用软删除。',
                      okText: '删除',
                      okButtonProps: { danger: true },
                      onOk: async () => {
                        for (const id of selectedRowKeys) {
                          await deleteCustomer(Number(id));
                        }
                        message.success(`已删除 ${selectedRowKeys.length} 个客户`);
                        setSelectedRowKeys([]);
                        actionRef.current?.reload();
                      },
                    });
                  }}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Tooltip>
            </Permission>
          ) : null,
          <BackendDownloadButton key="export" onClick={handleExportCustomers}>
            导出 Excel
          </BackendDownloadButton>,
          <Permission code="customer:create" key="import">
            <Button
              icon={<UploadOutlined />}
              onClick={() => {
                setImportModalOpen(true);
                setImportResult(null);
              }}
            >
              导入 Excel
            </Button>
          </Permission>,
          <Permission code="customer:create" key="create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              新增客户
            </Button>
          </Permission>,
        ]}
      />

      <ModalForm<CustomerForm>
        title={editing ? '编辑客户' : '新增客户'}
        open={open}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            setOpen(false);
            setEditing(null);
          },
        }}
        initialValues={editing ?? { level: 'NORMAL', status: 'ACTIVE' }}
        onFinish={submit}
      >
        <ProFormText name="name" label="客户名称" rules={[{ required: true }]} />
        <ProFormSelect
          name="level"
          label="客户级别"
          options={[
            { label: '重点客户', value: 'IMPORTANT' },
            { label: '普通客户', value: 'NORMAL' },
            { label: '潜在客户', value: 'POTENTIAL' },
          ]}
        />
        <ProFormText name="phone" label="手机" />
        <ProFormText name="email" label="邮箱" />
        <ProFormSelect
          name="status"
          label="状态"
          options={[
            { label: '有效', value: 'ACTIVE' },
            { label: '停用', value: 'DISABLED' },
          ]}
        />
        <ProFormTextArea name="remark" label="备注" fieldProps={{ rows: 3 }} />
      </ModalForm>

      <ExcelImportModal
        open={importModalOpen}
        title="导入客户 Excel"
        description="客户名称为必填字段；级别支持重点客户、普通客户、潜在客户；状态支持有效、停用。"
        templateDescription="模板由后端生成，字段顺序和导入解析保持一致，包含 3 行可直接试导入的示例数据。"
        sampleColumns={[...customerImportTemplateColumns]}
        sampleRows={customerImportTemplateRows}
        file={importFile}
        importing={importing}
        onDownloadTemplate={downloadImportTemplate}
        onFileChange={(file) => {
          setImportFile(file);
          setImportResult(null);
        }}
        onSubmit={submitImportCustomers}
        onCancel={() => {
          setImportModalOpen(false);
          setImportFile(null);
          setImportResult(null);
        }}
        result={
          importResult ? (
            <Alert
              style={{ whiteSpace: 'pre-line' }}
              type={importResult.failed > 0 ? 'warning' : 'success'}
              showIcon
              message={customerImportSummary(importResult)}
              description={customerImportFailureDetail(importResult) || '所有客户已导入。'}
            />
          ) : null
        }
      />
    </div>
  );
}

function levelText(level: CustomerRow['level']) {
  if (level === 'IMPORTANT') return '重点客户';
  if (level === 'POTENTIAL') return '潜在客户';
  return '普通客户';
}
