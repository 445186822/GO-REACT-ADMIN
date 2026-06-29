import { CloudDownloadOutlined } from '@ant-design/icons';
import { Button, Tooltip, type ButtonProps } from 'antd';
import type { ReactNode } from 'react';

const SOURCE_LABEL = '服务端文件';
const SOURCE_TIP = '服务端生成或返回文件流后下载';

type BackendDownloadButtonProps = Omit<ButtonProps, 'icon'> & {
  children: ReactNode;
  showBadge?: boolean;
};

export function BackendDownloadButton({ children, showBadge = true, ...buttonProps }: BackendDownloadButtonProps) {
  return (
    <Tooltip title={SOURCE_TIP}>
      <Button {...buttonProps} className="download-button download-button--backend" icon={<CloudDownloadOutlined />}>
        {showBadge ? (
          <span className="download-button-content">
            <span>{children}</span>
            <span className="download-source-badge">{SOURCE_LABEL}</span>
          </span>
        ) : (
          children
        )}
      </Button>
    </Tooltip>
  );
}
