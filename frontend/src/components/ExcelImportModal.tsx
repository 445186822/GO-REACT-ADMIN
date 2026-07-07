import { DownloadOutlined, FileExcelOutlined, InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Col, Modal, Row, Space, Table, Typography, Upload } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CSSProperties, ReactNode } from 'react';

type ExcelImportModalProps<T extends object> = {
  open: boolean;
  title: string;
  description: string;
  templateTitle?: string;
  templateDescription?: string;
  templateButtonText?: string;
  sampleColumns: ColumnsType<T>;
  sampleRows: T[];
  file: File | null;
  importing?: boolean;
  result?: ReactNode;
  onDownloadTemplate: () => void | Promise<void>;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
};

export function ExcelImportModal<T extends object>({
  open,
  title,
  description,
  templateTitle = '导入模板',
  templateDescription = '下载模板后按示例填写，再上传 .xlsx 文件。',
  templateButtonText = '下载 Excel 模板',
  sampleColumns,
  sampleRows,
  file,
  importing,
  result,
  onDownloadTemplate,
  onFileChange,
  onSubmit,
  onCancel,
}: ExcelImportModalProps<T>) {
  return (
    <Modal
      title={
        <Space>
          <FileExcelOutlined />
          {title}
        </Space>
      }
      open={open}
      width={900}
      okText="开始导入"
      cancelText="取消"
      okButtonProps={{ loading: importing, disabled: !file }}
      onOk={() => void onSubmit()}
      onCancel={onCancel}
      destroyOnHidden
      styles={{ body: { paddingTop: 12 } }}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert type="info" showIcon message={description} />
        <Row gutter={16}>
          <Col xs={24} lg={11}>
            <section style={panelStyle}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Typography.Text strong>{templateTitle}</Typography.Text>
                  <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                    {templateDescription}
                  </Typography.Paragraph>
                </div>
                <Button type="primary" ghost icon={<DownloadOutlined />} onClick={() => void onDownloadTemplate()}>
                  {templateButtonText}
                </Button>
                <Table<T>
                  size="small"
                  rowKey={(row, index) => String(index)}
                  columns={sampleColumns}
                  dataSource={sampleRows}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                />
              </Space>
            </section>
          </Col>
          <Col xs={24} lg={13}>
            <section style={panelStyle}>
              <Upload.Dragger
                accept=".xlsx"
                maxCount={1}
                fileList={file ? [{ uid: 'excel-import-file', name: file.name, status: 'done' }] : []}
                beforeUpload={(nextFile) => {
                  onFileChange(nextFile);
                  return false;
                }}
                onRemove={() => {
                  onFileChange(null);
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">拖入文件或点击选择</p>
                <p className="ant-upload-hint">仅支持 .xlsx 文件，建议直接使用模板填写。</p>
              </Upload.Dragger>
              {result ? <div style={{ marginTop: 16 }}>{result}</div> : null}
            </section>
          </Col>
        </Row>
      </Space>
    </Modal>
  );
}

const panelStyle: CSSProperties = {
  minHeight: 310,
  border: '1px solid #f0f0f0',
  borderRadius: 8,
  padding: 16,
  background: '#fff',
};
