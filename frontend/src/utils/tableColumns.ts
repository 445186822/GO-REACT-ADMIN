import type { ProColumns } from '@ant-design/pro-components';

const MIN_OPERATION_COLUMN_WIDTH = 180;

export function operationColumnProps<T = unknown>(width = MIN_OPERATION_COLUMN_WIDTH): Pick<ProColumns<T>, 'valueType' | 'width' | 'fixed' | 'className'> {
  return {
    valueType: 'option',
    width: Math.max(width, MIN_OPERATION_COLUMN_WIDTH),
    fixed: 'right',
    className: 'table-operation-column',
  };
}
