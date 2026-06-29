import { FileExcelOutlined } from '@ant-design/icons';
import { Button, Tooltip, type ButtonProps } from 'antd';
import type { ReactNode } from 'react';

const SOURCE_LABEL = '浏览器生成';
const SOURCE_TIP = '浏览器根据当前接口数据生成 Excel 文件';

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
