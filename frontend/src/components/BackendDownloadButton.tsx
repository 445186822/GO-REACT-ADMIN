import { CloudDownloadOutlined } from '@ant-design/icons';
import { Button, Tooltip, type ButtonProps } from 'antd';
import type { ReactNode } from 'react';

const SOURCE_LABEL = '\u540e\u7aef';
const SOURCE_TIP = '\u540e\u7aef\u8fd4\u56de\u6587\u4ef6\u6d41\u4e0b\u8f7d';

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
