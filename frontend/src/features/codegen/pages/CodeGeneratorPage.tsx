import { CodeOutlined, FileTextOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ProColumns, ProForm, ProFormSelect, ProFormSwitch, ProFormText, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Modal, Space, Tabs, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  generateCodegen,
  getCodegenColumns,
  listCodegenTables,
  previewCodegen,
  type CodegenColumn,
  type CodegenFile,
  type CodegenRequest,
  type CodegenTable,
} from '../../../api/codeGenerator';
import { Permission } from '../../../components/Permission';
import { message } from '../../../utils/message';
import { featureNameFromTable, moduleNameFromTable, permissionPrefixFromTable, routePathFromTable } from '../codegenNaming';

type CodegenForm = {
  feature_name: string;
  module_name: string;
  route_path: string;
  permission_prefix: string;
  menu_icon: string;
  overwrite?: boolean;
};

export function CodeGeneratorPage() {
  const [tables, setTables] = useState<CodegenTable[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState<CodegenColumn[]>([]);
  const [previewFiles, setPreviewFiles] = useState<CodegenFile[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form] = ProForm.useForm<CodegenForm>();

  const tableOptions = useMemo(
    () => tables.map((table) => ({ label: table.name, value: table.name })),
    [tables],
  );

  const columnTableColumns: ProColumns<CodegenColumn>[] = [
    { title: '字段', dataIndex: 'name', width: 160 },
    { title: '数据库类型', dataIndex: 'data_type', width: 170 },
    { title: 'TypeScript', dataIndex: 'typescript_type', width: 120 },
    { title: '表单控件', dataIndex: 'form_type', width: 120 },
    {
      title: '属性',
      search: false,
      render: (_, row) => (
        <Space size={4} wrap>
          {row.is_primary_key && <Tag color="gold">主键</Tag>}
          {!row.is_nullable && <Tag color="blue">必填</Tag>}
          {row.has_default && <Tag>默认值</Tag>}
          {row.editable ? <Tag color="green">可编辑</Tag> : <Tag color="default">只读</Tag>}
        </Space>
      ),
    },
  ];

  useEffect(() => {
    void loadTables();
  }, []);

  async function loadTables() {
    setLoadingTables(true);
    try {
      setTables(await listCodegenTables());
    } finally {
      setLoadingTables(false);
    }
  }

  async function handleTableChange(table: string) {
    setSelectedTable(table);
    setColumns([]);
    setPreviewFiles([]);
    if (!table) return;
    setLoadingColumns(true);
    try {
      const nextColumns = await getCodegenColumns(table);
      setColumns(nextColumns);
      const guessedModule = moduleNameFromTable(table);
      form.setFieldsValue({
        feature_name: featureNameFromTable(table),
        module_name: guessedModule,
        route_path: routePathFromTable(table),
        permission_prefix: permissionPrefixFromTable(table),
        menu_icon: 'CodeOutlined',
        overwrite: false,
      });
    } finally {
      setLoadingColumns(false);
    }
  }

  function requestFromForm(values: CodegenForm): CodegenRequest {
    return {
      table_name: selectedTable,
      feature_name: values.feature_name,
      module_name: values.module_name,
      route_path: values.route_path,
      permission_prefix: values.permission_prefix,
      menu_icon: values.menu_icon || 'CodeOutlined',
      overwrite: values.overwrite,
      columns,
    };
  }

  async function handlePreview() {
    const values = await form.validateFields();
    if (!selectedTable) {
      message.warning('请选择业务表');
      return;
    }
    setPreviewing(true);
    try {
      const files = await previewCodegen(requestFromForm(values));
      setPreviewFiles(files);
      message.success('代码预览已生成');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerate() {
    const values = await form.validateFields();
    if (!selectedTable || previewFiles.length === 0) {
      message.warning('请先生成预览');
      return;
    }
    Modal.confirm({
      title: '确认生成代码?',
      content: '将根据当前预览写入源码文件。已有文件默认不会覆盖。',
      okText: '确认生成',
      cancelText: '取消',
      onOk: async () => {
        setGenerating(true);
        try {
          const files = await generateCodegen(requestFromForm(values));
          setPreviewFiles(files);
          message.success('代码文件已生成');
        } finally {
          setGenerating(false);
        }
      },
    });
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="快速生成代码"
          description="仅支持 biz_ 前缀业务表。先生成预览，确认后再写入源码文件。"
        />

        <div className="page-status-strip">
          <Space wrap>
            <ProFormSelect
              noStyle
              width={280}
              fieldProps={{
                loading: loadingTables,
                value: selectedTable || undefined,
                options: tableOptions,
                placeholder: '选择业务表',
                onChange: (value) => void handleTableChange(String(value ?? '')),
              }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadTables()}>
              刷新表
            </Button>
            {selectedTable && <Tag color="blue">{selectedTable}</Tag>}
          </Space>
        </div>

        <ProForm<CodegenForm>
          form={form}
          layout="horizontal"
          submitter={false}
          grid
          rowProps={{ gutter: 12 }}
        >
          <ProFormText
            colProps={{ xs: 24, md: 8 }}
            name="feature_name"
            label="功能名称"
            rules={[{ required: true }]}
            placeholder="合同管理"
          />
          <ProFormText
            colProps={{ xs: 24, md: 8 }}
            name="module_name"
            label="模块名"
            rules={[{ required: true }]}
            placeholder="contract"
          />
          <ProFormText
            colProps={{ xs: 24, md: 8 }}
            name="permission_prefix"
            label="权限前缀"
            rules={[{ required: true }]}
            placeholder="contract"
          />
          <ProFormText
            colProps={{ xs: 24, md: 8 }}
            name="route_path"
            label="路由"
            rules={[{ required: true }]}
            placeholder="/business/contracts"
          />
          <ProFormSelect
            colProps={{ xs: 24, md: 8 }}
            name="menu_icon"
            label="菜单图标"
            initialValue="CodeOutlined"
            options={[
              { label: 'CodeOutlined', value: 'CodeOutlined' },
              { label: 'TableOutlined', value: 'TableOutlined' },
              { label: 'AppstoreOutlined', value: 'AppstoreOutlined' },
            ]}
          />
          <ProFormSwitch colProps={{ xs: 24, md: 8 }} name="overwrite" label="覆盖已有文件" />
        </ProForm>

        <Space wrap>
          <Button type="primary" icon={<FileTextOutlined />} loading={previewing} onClick={() => void handlePreview()}>
            生成预览
          </Button>
          <Permission code="code-generator:create">
            <Button icon={<ThunderboltOutlined />} loading={generating} disabled={previewFiles.length === 0} onClick={() => void handleGenerate()}>
              确认生成
            </Button>
          </Permission>
        </Space>

        <ProTable<CodegenColumn>
          rowKey="name"
          columns={columnTableColumns}
          dataSource={columns}
          loading={loadingColumns}
          search={false}
          pagination={false}
          scroll={{ x: 'max-content' }}
          headerTitle="字段映射预览"
        />

        {previewFiles.length > 0 && (
          <div>
            <Typography.Text strong>
              <CodeOutlined /> 生成文件预览
            </Typography.Text>
            <Tabs
              style={{ marginTop: 8 }}
              items={previewFiles.map((file) => ({
                key: file.path,
                label: file.exists ? `${file.path}（已存在）` : file.path,
                children: (
                  <pre style={{ margin: 0, maxHeight: 420, overflow: 'auto', background: '#0f172a', color: '#e2e8f0', padding: 16 }}>
                    {file.content}
                  </pre>
                ),
              }))}
            />
          </div>
        )}
      </Space>
    </div>
  );
}
