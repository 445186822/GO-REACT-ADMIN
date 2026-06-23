import { FileExcelOutlined } from '@ant-design/icons';
import { Button, Tooltip, type ButtonProps } from 'antd';
import type { ReactNode } from 'react';

const SOURCE_LABEL = '\u524d\u7aef';
const SOURCE_TIP = '\u524d\u7aef\u751f\u6210\u6587\u4ef6\u5e76\u4e0b\u8f7d';

type ExportButtonProps = Omit<ButtonProps, 'icon'> & {
  children: ReactNode;
};

export function ExportButton({ children, ...buttonProps }: ExportButtonProps) {
  return (
    <Tooltip title={SOURCE_TIP}>
      <Button {...buttonProps} className="download-button download-button--frontend" icon={<FileExcelOutlined />}>
        <span className="download-button-content">
          <span>{children}</span>
          <span className="download-source-badge">{SOURCE_LABEL}</span>
        </span>
      </Button>
    </Tooltip>
  );
}
