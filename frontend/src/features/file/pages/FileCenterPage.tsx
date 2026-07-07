import { DeleteOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { ProColumns, ProTable, type ActionType } from '@ant-design/pro-components';
import { App, Button, Image, Modal, Space, Tag, Typography, Upload } from 'antd';
import { message } from '../../../utils/message';
import { useEffect, useRef, useState } from 'react';
import { deleteFile, downloadFile, listFiles, uploadFile, createFileObjectUrl, type FileRow } from '../../../api/files';
import { Permission } from '../../../components/Permission';
import { BackendDownloadButton } from '../../../components/BackendDownloadButton';
import { ExportButton } from '../../../components/ExportButton';
import { exportExcel } from '../../../utils/exportExcel';
import { operationColumnProps } from '../../../utils/tableColumns';

export function FileCenterPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

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
    { title: '类型', dataIndex: 'mime_type', search: false, render: (_, row) => <Tag>{row.mime_type}</Tag>, width: 100 },
    { title: '大小', dataIndex: 'size', search: false, renderText: (value) => formatSize(Number(value)), width: 150 },
    { title: '上传人', dataIndex: 'uploader', search: false, width: 150 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', search: false, width: 180 },
    {
      title: '操作',
      ...operationColumnProps<FileRow>(260),
      render: (_, row) => (
        <Space wrap={false} className="table-action-buttons">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setPreviewFile(row)}>
            预览
          </Button>
          <BackendDownloadButton type="link" size="small" showBadge={false} onClick={() => handleDownload(row)}>
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

  function isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  // Fetch preview image as blob URL with auth, so the <Image> tag can display it
  useEffect(() => {
    if (!previewFile || !isImage(previewFile.mime_type)) {
      setPreviewUrl('');
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    createFileObjectUrl(previewFile.id)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) message.error('预览加载失败');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewFile]);

  function closePreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewUrl('');
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
    <div style={{ padding: '0 0 24px' }}>
      <ProTable<FileRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        search={{ labelWidth: 80 }}
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
              disabled={uploading}
              customRequest={async ({ file, onError, onSuccess }) => {
                setUploading(true);
                setUploadProgress(0);
                try {
                  await uploadFile(file as File, (pct) => setUploadProgress(pct));
                  message.success('文件已上传');
                  actionRef.current?.reload();
                  onSuccess?.({});
                } catch (error) {
                  onError?.(error as Error);
                } finally {
                  setUploading(false);
                  setUploadProgress(0);
                }
              }}
            >
              <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
                {uploading ? `上传中 ${uploadProgress}%` : '上传文件'}
              </Button>
            </Upload>
          </Permission>,
        ]}
      />

      {/* File Preview Modal */}
      <Modal
        title={previewFile?.original_name}
        open={Boolean(previewFile)}
        onCancel={closePreview}
        footer={null}
        width={720}
      >
        {previewFile && (
          <div style={{ textAlign: 'center' }}>
            {isImage(previewFile.mime_type) ? (
              previewLoading ? (
                <div style={{ padding: 40 }}>
                  <Typography.Text type="secondary">加载预览中...</Typography.Text>
                </div>
              ) : previewUrl ? (
                <Image
                  src={previewUrl}
                  alt={previewFile.original_name}
                  style={{ maxWidth: '100%' }}
                  preview={false}
                />
              ) : (
                <div style={{ padding: 40 }}>
                  <Typography.Text type="secondary">预览加载失败</Typography.Text>
                </div>
              )
            ) : (
              <div style={{ padding: 40 }}>
                <EyeOutlined style={{ fontSize: 48, color: '#999', marginBottom: 16 }} />
                <br />
                <Typography.Text type="secondary">
                  该文件类型暂不支持直接预览，请下载后查看。
                </Typography.Text>
                <br />
                <br />
                <Button type="primary" onClick={() => handleDownload(previewFile)}>
                  下载文件
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
