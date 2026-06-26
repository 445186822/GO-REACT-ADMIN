import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { ProColumns, ProTable, type ActionType } from '@ant-design/pro-components';
import { App, Button, Space, Tag, Typography, Upload, message } from 'antd';
import { useRef } from 'react';
import { deleteFile, downloadFile, listFiles, uploadFile, type FileRow } from '../../../api/files';
import { Permission } from '../../../components/Permission';
import { BackendDownloadButton } from '../../../components/BackendDownloadButton';
import { ExportButton } from '../../../components/ExportButton';
import { exportExcel } from '../../../utils/exportExcel';

export function FileCenterPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<FileRow>[] = [
    {
      title: '文件名',
      dataIndex: 'original_name',
      copyable: true,
      render: (_, row) => (
        <BackendDownloadButton type="link" size="small" showBadge={false} onClick={() => handleDownload(row)}>
          {row.original_name}
        </BackendDownloadButton>
      ),
    },
    { title: '类型', dataIndex: 'mime_type', search: false, render: (_, row) => <Tag>{row.mime_type}</Tag> },
    { title: '大小', dataIndex: 'size', search: false, renderText: (value) => formatSize(Number(value)) },
    { title: '上传人', dataIndex: 'uploader', search: false },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', search: false },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, row) => (
        <Space>
          <BackendDownloadButton type="link" size="small" onClick={() => handleDownload(row)}>
            下载
          </BackendDownloadButton>
          <Permission code="file:delete">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  function confirmDelete(row: FileRow) {
    modal.confirm({
      title: `删除 ${row.original_name}?`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteFile(row.id);
        message.success('文件已删除');
        actionRef.current?.reload();
      },
    });
  }

  async function handleDownload(row: FileRow) {
    try {
      await downloadFile(row);
    } catch {
      message.error('下载失败');
    }
  }

  async function exportFiles() {
    const data = await listFiles({ page: 1, page_size: 10000 });
    await exportExcel<FileRow>(
      'files.xlsx',
      'Files',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '文件名', dataIndex: 'original_name' },
        { title: '类型', dataIndex: 'mime_type' },
        { title: '大小', dataIndex: 'size' },
        { title: '上传人', dataIndex: 'uploader' },
        { title: '业务类型', dataIndex: 'biz_type' },
        { title: '业务 ID', dataIndex: 'biz_id' },
        { title: '创建时间', dataIndex: 'created_at' },
      ],
      data.items,
    );
    message.success('文件列表 Excel 已生成');
  }

  return (
    <div>
      <Typography.Title level={3}>文件中心</Typography.Title>
      <ProTable<FileRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 80 }}
        scroll={{ x: 1000 }}
        request={async (params) => {
          const data = await listFiles({
            keyword: params.keyword as string | undefined,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        toolBarRender={() => [
          <ExportButton key="export" onClick={exportFiles}>
            导出 Excel
          </ExportButton>,
          <Permission code="file:upload" key="upload">
            <Upload
              showUploadList={false}
              customRequest={async ({ file, onError, onSuccess }) => {
                try {
                  await uploadFile(file as File);
                  message.success('文件已上传');
                  actionRef.current?.reload();
                  onSuccess?.({});
                } catch (error) {
                  onError?.(error as Error);
                }
              }}
            >
              <Button type="primary" icon={<UploadOutlined />}>
                上传文件
              </Button>
            </Upload>
          </Permission>,
        ]}
      />
    </div>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

